// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { StartStreamTranscriptionCommand, TranscribeStreamingClient } from "@aws-sdk/client-transcribe-streaming";
import { TRANSCRIBE_CONFIG } from "../config";
import { LOGGER_PREFIX, TRANSCRIBE_PARTIAL_RESULTS_STABILITY } from "../constants";
import { getValidAwsCredentials, hasValidAwsCredentials } from "../utils/authUtility";
import { isObjectUndefinedNullEmpty, isStringUndefinedNullEmpty } from "../utils/commonUtility";
import { getTranscribeAudioStream, getTranscribeMicStream } from "../utils/transcribeUtils";

export const listStreamingLanguages = () => ["en-US", "es-US", "fr-CA", "de-DE"];

let _amazonTranscribeClientAgent;
let _amazonTranscribeClientCustomer;

export async function getAmazonTranscribeClientAgent() {
  try {
    if (_amazonTranscribeClientAgent != null && hasValidAwsCredentials()) {
      return _amazonTranscribeClientAgent;
    }

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
  onPartialTranscribeEvent,
  onLanguageIdentified
) {
  if (isObjectUndefinedNullEmpty(audioStream)) throw new Error("audioStream is required");
  if (!Number.isInteger(sampleRate)) throw new Error("sampleRate is required as integer");
  if (isStringUndefinedNullEmpty(languageCode)) throw new Error("languageCode is required");
  if (isStringUndefinedNullEmpty(partialResultStability)) throw new Error("partialResultStability is required");
  if (typeof onFinalTranscribeEvent !== 'function') throw new Error("onFinalTranscribeEvent is required");
  if (typeof onPartialTranscribeEvent !== 'function') throw new Error("onPartialTranscribeEvent is required");

  const enablePartialResultsStabilization = TRANSCRIBE_PARTIAL_RESULTS_STABILITY.includes(partialResultStability);

  console.log('Starting transcription with language detection...');
  const startStreamTranscriptionCommand = new StartStreamTranscriptionCommand({
    IdentifyLanguage: true,
    LanguageOptions: 'en-US,es-US,fr-CA,de-DE',
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
    console.log('Raw event:', JSON.stringify(event.TranscriptEvent));
    const transcriptResults = event.TranscriptEvent.Transcript.Results;

    if (transcriptResults[0]?.LanguageIdentification) {
      const langId = transcriptResults[0].LanguageIdentification;
      console.log('Language scores:', langId);
      const bestMatch = langId.reduce((prev, curr) => 
        (curr.Score > prev.Score) ? curr : prev
      );
      console.log('Best match:', bestMatch);
      
      if (onLanguageIdentified) {
        onLanguageIdentified({
          languageCode: bestMatch.LanguageCode,
          score: bestMatch.Score
        });
      }
    }

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
  if (typeof onFinalTranscribeEvent !== 'function') throw new Error("onFinalTranscribeEvent is required");
  if (typeof onPartialTranscribeEvent !== 'function') throw new Error("onPartialTranscribeEvent is required");

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
    console.log('Raw event data:', event.TranscriptEvent);
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

  const partialTranscriptItems = transcriptResults[0].Alternatives[0].Items;
  if (partialTranscriptItems?.length > 0) {
    const partialTranscript = joinTranscriptItems(partialTranscriptItems, lastProcessedIndex);
    return { partialTranscript };
  }
  return null;
}

function getFinalTranscript(transcriptResults = [], lastProcessedIndex = 0, enablePartialResultsStabilization = false) {
  if (transcriptResults.length === 0) return null;
  if (transcriptResults[0].IsPartial === true && enablePartialResultsStabilization === false) return null;

  if (transcriptResults[0].IsPartial === false) {
    const finalTranscriptItems = transcriptResults[0].Alternatives[0].Items;
    if (finalTranscriptItems?.length > 0) {
      const finalTranscript = joinTranscriptItems(finalTranscriptItems, lastProcessedIndex);
      return { finalTranscript, lastProcessedIndex: 0 };
    }
  }

  const firstSegmentEndIndex = transcriptResults[0].Alternatives[0].Items.findIndex(
    (item, index) => index >= lastProcessedIndex && item.Type === "punctuation" && [",", ".", "!", "?"].includes(item.Content)
  );
  if (firstSegmentEndIndex === -1) return null;

  const segmentItems = transcriptResults[0].Alternatives[0].Items.slice(lastProcessedIndex, firstSegmentEndIndex + 1);
  const allItemsAreStable = segmentItems.every((item) => item.Stable === true);
  if (allItemsAreStable === false) return null;

  const finalTranscript = joinTranscriptItems(segmentItems, 0);
  return { finalTranscript, lastProcessedIndex: firstSegmentEndIndex + 1 };
}

function joinTranscriptItems(transcriptItems = [], lastProcessedIndex = 0) {
  return transcriptItems
    .slice(lastProcessedIndex)
    .map((item) => item.Content)
    .join(" ")
    .trim()
    .replace(/\s+([.,!?])/g, "$1");
}