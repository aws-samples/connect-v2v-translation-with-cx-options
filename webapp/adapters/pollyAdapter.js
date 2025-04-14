// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { DescribeVoicesCommand, PollyClient, SynthesizeSpeechCommand, LanguageCode, Engine } from "@aws-sdk/client-polly";
import { hasValidAwsCredentials, getValidAwsCredentials } from "../utils/authUtility";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { POLLY_CONFIG } from "../config";
import { LOGGER_PREFIX } from "../constants";
import { Buffer } from "buffer";
import { isDevEnvironment, isStringUndefinedNullEmpty } from "../utils/commonUtility";

let _amazonPollyClient;

async function getAmazonPollyClient() {
  try {
    if (_amazonPollyClient != null && hasValidAwsCredentials()) {
      // console.info(
      //   `${LOGGER_PREFIX} - getAmazonPollyClient - Reusing existing Polly client`
      // );
      return _amazonPollyClient;
    }

    // Initialize AWS services with credentials
    const credentials = await getValidAwsCredentials();
    _amazonPollyClient = new PollyClient({
      region: POLLY_CONFIG.pollyRegion,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    //if not running on localhost, add proxy
    if (!isDevEnvironment() && POLLY_CONFIG.pollyProxyEnabled) {
      _amazonPollyClient.middlewareStack.add(
        (next) => async (args) => {
          if (HttpRequest.isInstance(args.request)) {
            // Change the hostname and add the proxy path
            args.request.hostname = POLLY_CONFIG.pollyProxyHostname;
            args.request.path = "/amazon-polly-proxy" + args.request.path;
          }
          return next(args);
        },
        {
          step: "finalizeRequest", // After signature calculation
          name: "addProxyEndpointMiddleware",
        }
      );
    }

    // console.info(
    //   `${LOGGER_PREFIX} - getAmazonPollyClient - Created new Polly client`
    // );
    return _amazonPollyClient;
  } catch (error) {
    console.error(`${LOGGER_PREFIX} - initializeAwsServices - Error initializing AWS services:`, error);
    throw error;
  }
}

export function listPollyLanguages() {
  //returns an array of Polly language codes
  return Object.values(LanguageCode);
}

export function listPollyEngines() {
  //returns an array of Polly engines
  return Object.values(Engine);
}

export async function describeVoices(languageCode, engine) {
  if (isStringUndefinedNullEmpty(languageCode)) throw new Error("languageCode is required");
  if (isStringUndefinedNullEmpty(engine)) throw new Error("engine is required");

  const describeVoicesCommand = new DescribeVoicesCommand({
    LanguageCode: languageCode,
    Engine: engine,
    IncludeAdditionalLanguageCodes: true,
  });

  const amazonPollyClient = await getAmazonPollyClient();
  const response = await amazonPollyClient.send(describeVoicesCommand);
  return response.Voices;
}

export async function synthesizeSpeech(languageCode, engine, voiceId, inputText) {
  if (isStringUndefinedNullEmpty(languageCode)) throw new Error("languageCode is required");
  if (isStringUndefinedNullEmpty(engine)) throw new Error("engine is required");
  if (isStringUndefinedNullEmpty(voiceId)) throw new Error("voiceId is required");
  if (isStringUndefinedNullEmpty(inputText)) throw new Error("inputText is required");

  const synthesizeSpeechCommand = new SynthesizeSpeechCommand({
    OutputFormat: "ogg_vorbis",
    LanguageCode: languageCode,
    Engine: engine,
    VoiceId: voiceId,
    Text: inputText,
  });

  const amazonPollyClient = await getAmazonPollyClient();
  const response = await amazonPollyClient.send(synthesizeSpeechCommand);
  const audioDataArray = await response.AudioStream.transformToByteArray();
  const base64AudioData = Buffer.from(audioDataArray).toString("base64");
  return base64AudioData;
}
