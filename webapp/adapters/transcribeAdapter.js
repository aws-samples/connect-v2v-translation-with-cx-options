// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { StartStreamTranscriptionCommand, TranscribeStreamingClient, LanguageCode } from "@aws-sdk/client-transcribe-streaming";
import { TRANSCRIBE_CONFIG } from "../config";
import { LOGGER_PREFIX, TRANSCRIBE_PARTIAL_RESULTS_STABILITY } from "../constants";
import { getValidAwsCredentials, hasValidAwsCredentials } from "../utils/authUtility";
import { isFunction, isObjectUndefinedNullEmpty, isStringUndefinedNullEmpty } from "../utils/commonUtility";
import { getTranscribeAudioStream, getTranscribeMicStream } from "../utils/transcribeUtils";

let _amazonTranscribeClientAgent;
let _amazonTranscribeClientCustomer;

export async function getAmazonTranscribeClientAgent() {
  try {
    if (_amazonTranscribeClientAgent != null && hasValidAwsCredentials()) {
      return _amazonTranscribeClientAgent;
    }

    // Initialize AWS services with credentials
    const credentials = await getValidAwsCredentials();
    _amazonTranscribeClientAgent = new TranscribeStreamingClient({
      region: TRANSCRIBE_CONFIG.transcribeRegion,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    return _amazonTranscribeClientAgent;
  } catch (error) {
    console.error(`${LOGGER_PREFIX} - initializeAwsServices - Error initializing AWS services:`, error);
    throw error;
  }
}

export async function getAmazonTranscribeClientCustomer() {
  try {
    if (_amazonTranscribeClientCustomer != null && hasValidAwsCredentials()) {
      return _amazonTranscribeClientCustomer;
    }

    // Initialize AWS services with credentials
    const credentials = await getValidAwsCredentials();
    _amazonTranscribeClientCustomer = new TranscribeStreamingClient({
      region: TRANSCRIBE_CONFIG.transcribeRegion,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    return _amazonTranscribeClientCustomer;
  } catch (error) {
    console.error(`${LOGGER_PREFIX} - initializeAwsServices - Error initializing AWS services:`, error);
    throw error;
  }
}

export async function startCustomerStreamTranscription(
  audioStream,
  sampleRate,
  languageCode,
  partialResultStability,
  onFinalTranscribeEvent,
  onPartialTranscribeEvent
) {
  if (isObjectUndefinedNullEmpty(audioStream)) throw new Error("audioStream is required");
  if (!Number.isInteger(sampleRate)) throw new Error("sampleRate is required as integer");
  if (isStringUndefinedNullEmpty(languageCode)) throw new Error("languageCode is required");
  if (isStringUndefinedNullEmpty(partialResultStability)) throw new Error("partialResultStability is required");
  if (isFunction(onFinalTranscribeEvent)) throw new Error("onFinalTranscribeEvent is required");
  if (isFunction(onPartialTranscribeEvent)) throw new Error("onPartialTranscribeEvent is required");

  const enablePartialResultsStabilization = TRANSCRIBE_PARTIAL_RESULTS_STABILITY.includes(partialResultStability);

  const startStreamTranscriptionCommand = new StartStreamTranscriptionCommand({
    LanguageCode: languageCode,
    MediaEncoding: "pcm",
    MediaSampleRateHertz: sampleRate,
    AudioStream: getTranscribeAudioStream(audioStream, sampleRate),
    EnablePartialResultsStabilization: enablePartialResultsStabilization,
    PartialResultsStability: enablePartialResultsStabilization ? partialResultStability : undefined,
  });

  const amazonTranscribeClientCustomer = await getAmazonTranscribeClientCustomer();
  const startStreamTranscriptionResponse = await amazonTranscribeClientCustomer.send(startStreamTranscriptionCommand);

  let lastProcessedIndex = 0;

  for await (const event of startStreamTranscriptionResponse.TranscriptResultStream) {
    const transcriptResults = event.TranscriptEvent.Transcript.Results;

    const getPartialTranscriptResult = getPartialTranscript(transcriptResults, lastProcessedIndex);
    if (getPartialTranscriptResult != null) onPartialTranscribeEvent(getPartialTranscriptResult.partialTranscript);

    const getFinalTranscriptResult = getFinalTranscript(transcriptResults, lastProcessedIndex, enablePartialResultsStabilization);
    if (getFinalTranscriptResult != null) {
      lastProcessedIndex = getFinalTranscriptResult.lastProcessedIndex;
      onFinalTranscribeEvent(getFinalTranscriptResult.finalTranscript);
    }
  }
}

export async function startAgentStreamTranscription(
  audioStream,
  sampleRate,
  languageCode,
  partialResultStability,
  onFinalTranscribeEvent,
  onPartialTranscribeEvent
) {
  if (isObjectUndefinedNullEmpty(audioStream)) throw new Error("audioStream is required");
  if (!Number.isInteger(sampleRate)) throw new Error("sampleRate is required as integer");
  if (isStringUndefinedNullEmpty(languageCode)) throw new Error("languageCode is required");
  if (isStringUndefinedNullEmpty(partialResultStability)) throw new Error("partialResultStability is required");
  if (isFunction(onFinalTranscribeEvent)) throw new Error("onFinalTranscribeEvent is required");
  if (isFunction(onPartialTranscribeEvent)) throw new Error("onPartialTranscribeEvent is required");

  const enablePartialResultsStabilization = TRANSCRIBE_PARTIAL_RESULTS_STABILITY.includes(partialResultStability);

  const startStreamTranscriptionCommand = new StartStreamTranscriptionCommand({
    LanguageCode: languageCode,
    MediaEncoding: "pcm",
    MediaSampleRateHertz: sampleRate,
    AudioStream: getTranscribeMicStream(audioStream, sampleRate),
    EnablePartialResultsStabilization: enablePartialResultsStabilization,
    PartialResultsStability: enablePartialResultsStabilization ? partialResultStability : undefined,
  });

  const amazonTranscribeClientAgent = await getAmazonTranscribeClientAgent();
  const startStreamTranscriptionResponse = await amazonTranscribeClientAgent.send(startStreamTranscriptionCommand);

  let lastProcessedIndex = 0;

  for await (const event of startStreamTranscriptionResponse.TranscriptResultStream) {
    const transcriptResults = event.TranscriptEvent.Transcript.Results;

    const getPartialTranscriptResult = getPartialTranscript(transcriptResults, lastProcessedIndex);
    if (getPartialTranscriptResult != null) onPartialTranscribeEvent(getPartialTranscriptResult.partialTranscript);

    const getFinalTranscriptResult = getFinalTranscript(transcriptResults, lastProcessedIndex, enablePartialResultsStabilization);
    if (getFinalTranscriptResult != null) {
      lastProcessedIndex = getFinalTranscriptResult.lastProcessedIndex;
      onFinalTranscribeEvent(getFinalTranscriptResult.finalTranscript);
    }
  }
}

function getPartialTranscript(transcriptResults = [], lastProcessedIndex = 0) {
  if (transcriptResults.length === 0) return null;
  if (transcriptResults[0].IsPartial !== true) return null;

  // Handle regular partial transcript - to update the UI as quickly as possible
  const partialTranscriptItems = transcriptResults[0].Alternatives[0].Items;
  if (partialTranscriptItems?.length > 0) {
    // Get only the items after lastProcessedIndex
    const partialTranscript = joinTranscriptItems(partialTranscriptItems, lastProcessedIndex);
    return { partialTranscript };
  }
}

function getFinalTranscript(transcriptResults = [], lastProcessedIndex = 0, enablePartialResultsStabilization = false) {
  if (transcriptResults.length === 0) return null;
  if (transcriptResults[0].IsPartial === true && enablePartialResultsStabilization === false) return null;

  //Handle regular final transcript
  if (transcriptResults[0].IsPartial === false) {
    const finalTranscriptItems = transcriptResults[0].Alternatives[0].Items;
    if (finalTranscriptItems?.length > 0) {
      const finalTranscript = joinTranscriptItems(finalTranscriptItems, lastProcessedIndex);
      return { finalTranscript, lastProcessedIndex: 0 };
    }
  }

  // If transcript is partial, check if we have a stable transcript
  // Stable transcript is a transcript where all items are stable and the last item is a punctuation

  // Find the index of the first punctuation after the lastProcessedIndex
  const firstSegmentEndIndex = transcriptResults[0].Alternatives[0].Items.findIndex(
    (item, index) => index >= lastProcessedIndex && item.Type === "punctuation" && [",", ".", "!", "?"].includes(item.Content)
  );
  if (firstSegmentEndIndex === -1) return null; // We were not able to find a punctuation

  // Get all items up to and including the punctuation
  const segmentItems = transcriptResults[0].Alternatives[0].Items.slice(lastProcessedIndex, firstSegmentEndIndex + 1);

  // Check if ALL items in this segment are stable
  const allItemsAreStable = segmentItems.every((item) => item.Stable === true);
  if (allItemsAreStable === false) return null; // We were not able to find a punctuation

  const stableTranscript = joinTranscriptItems(segmentItems);
  return { finalTranscript: stableTranscript, lastProcessedIndex: firstSegmentEndIndex + 1 };
}

function joinTranscriptItems(transcriptItems = [], lastProcessedIndex = 0) {
  const resultTranscriptString = transcriptItems
    .slice(lastProcessedIndex)
    .map((item) => item.Content)
    .join(" ")
    .trim()
    .replace(/\s+([.,!?])/g, "$1"); // Clean up spaces before punctuation
  return resultTranscriptString;
}

export function listStreamingLanguages() {
  //returns an array of streaming language codes
  return Object.values(LanguageCode);
}
