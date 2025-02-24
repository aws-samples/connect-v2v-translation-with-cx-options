// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { StartStreamTranscriptionCommand, TranscribeStreamingClient } from "@aws-sdk/client-transcribe-streaming";
import { TRANSCRIBE_CONFIG } from "../config";
import { LOGGER_PREFIX, TRANSCRIBE_SAMPLE_RATE_AGENT, TRANSCRIBE_SAMPLE_RATE_CUSTOMER } from "../constants";
import { getValidAwsCredentials, hasValidAwsCredentials } from "../utils/authUtility";
import { isFunction, isObjectUndefinedNullEmpty, isStringUndefinedNullEmpty } from "../utils/commonUtility";
import { getTranscribeAudioStream, getTranscribeMicStream } from "../utils/transcribeUtils";

let _amazonTranscribeClientAgent;
let _amazonTranscribeClientCustomer;

export async function getAmazonTranscribeClientAgent() {
  try {
    if (_amazonTranscribeClientAgent != null && hasValidAwsCredentials()) {
      // console.info(
      //   `${LOGGER_PREFIX} - getAmazonTranscribeClientAgent - Reusing existing Transcribe client`
      // );
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

    // console.info(
    //   `${LOGGER_PREFIX} - getAmazonTranscribeClientAgent - Created new Transcribe client`
    // );
    return _amazonTranscribeClientAgent;
  } catch (error) {
    console.error(`${LOGGER_PREFIX} - initializeAwsServices - Error initializing AWS services:`, error);
    throw error;
  }
}

export async function getAmazonTranscribeClientCustomer() {
  try {
    if (_amazonTranscribeClientCustomer != null && hasValidAwsCredentials()) {
      // console.info(
      //   `${LOGGER_PREFIX} - getAmazonTranscribeClientCustomer - Reusing existing Transcribe client`
      // );
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

    // console.info(
    //   `${LOGGER_PREFIX} - getAmazonTranscribeClientCustomer - Created new Transcribe client`
    // );
    return _amazonTranscribeClientCustomer;
  } catch (error) {
    console.error(`${LOGGER_PREFIX} - initializeAwsServices - Error initializing AWS services:`, error);
    throw error;
  }
}

export async function startCustomerStreamTranscription(audioStream, languageCode, onFinalTranscribeEvent, onPartialTranscribeEvent) {
  if (isObjectUndefinedNullEmpty(audioStream)) throw new Error("audioStream is required");
  if (isStringUndefinedNullEmpty(languageCode)) throw new Error("languageCode is required");
  if (isFunction(onFinalTranscribeEvent)) throw new Error("onFinalTranscribeEvent is required");
  if (isFunction(onPartialTranscribeEvent)) throw new Error("onPartialTranscribeEvent is required");

  const startStreamTranscriptionCommand = new StartStreamTranscriptionCommand({
    LanguageCode: languageCode,
    MediaEncoding: "pcm",
    MediaSampleRateHertz: TRANSCRIBE_SAMPLE_RATE_CUSTOMER,
    AudioStream: getTranscribeAudioStream(audioStream),
  });

  const amazonTranscribeClientCustomer = await getAmazonTranscribeClientCustomer();
  const startStreamTranscriptionResponse = await amazonTranscribeClientCustomer.send(startStreamTranscriptionCommand);

  for await (const event of startStreamTranscriptionResponse.TranscriptResultStream) {
    const results = event.TranscriptEvent.Transcript.Results;
    if (results?.length > 0) {
      if (results[0]?.IsPartial === true) {
        const partialTranscript = results[0].Alternatives[0].Transcript;
        onPartialTranscribeEvent(partialTranscript);
      } else {
        const newTranscript = results[0].Alternatives[0].Transcript;
        onFinalTranscribeEvent(newTranscript);
      }
    }
  }
}

export async function startAgentStreamTranscription(audioStream, languageCode, onFinalTranscribeEvent, onPartialTranscribeEvent) {
  if (isObjectUndefinedNullEmpty(audioStream)) throw new Error("audioStream is required");
  if (isStringUndefinedNullEmpty(languageCode)) throw new Error("languageCode is required");
  if (isFunction(onFinalTranscribeEvent)) throw new Error("onFinalTranscribeEvent is required");
  if (isFunction(onPartialTranscribeEvent)) throw new Error("onPartialTranscribeEvent is required");

  const startStreamTranscriptionCommand = new StartStreamTranscriptionCommand({
    LanguageCode: languageCode,
    MediaEncoding: "pcm",
    MediaSampleRateHertz: TRANSCRIBE_SAMPLE_RATE_AGENT,
    AudioStream: getTranscribeMicStream(audioStream),
  });

  const amazonTranscribeClientAgent = await getAmazonTranscribeClientAgent();
  const startStreamTranscriptionResponse = await amazonTranscribeClientAgent.send(startStreamTranscriptionCommand);

  for await (const event of startStreamTranscriptionResponse.TranscriptResultStream) {
    const results = event.TranscriptEvent.Transcript.Results;
    if (results?.length > 0) {
      if (results[0]?.IsPartial === true) {
        const partialTranscript = results[0].Alternatives[0].Transcript;
        onPartialTranscribeEvent(partialTranscript);
      } else {
        const newTranscript = results[0].Alternatives[0].Transcript;
        onFinalTranscribeEvent(newTranscript);
      }
    }
  }
}
