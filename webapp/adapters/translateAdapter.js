// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { ListLanguagesCommand, TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { hasValidAwsCredentials, getValidAwsCredentials } from "../utils/authUtility";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { LOGGER_PREFIX } from "../constants";
import { TRANSLATE_CONFIG } from "../config";
import { isDevEnvironment, isStringUndefinedNullEmpty } from "../utils/commonUtility";

let _amazonTranslateClient;

async function getAmazonTranslateClient() {
  try {
    if (_amazonTranslateClient != null && hasValidAwsCredentials()) {
      // console.info(
      //   `${LOGGER_PREFIX} - getAmazonTranslateClient - Reusing existing Translate client`
      // );
      return _amazonTranslateClient;
    }

    // Initialize AWS services with credentials
    const credentials = await getValidAwsCredentials();
    _amazonTranslateClient = new TranslateClient({
      region: TRANSLATE_CONFIG.translateRegion,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    //if not running on localhost, add proxy
    if (!isDevEnvironment() && TRANSLATE_CONFIG.translateProxyEnabled) {
      _amazonTranslateClient.middlewareStack.add(
        (next) => async (args) => {
          if (HttpRequest.isInstance(args.request)) {
            // Change the hostname and add the proxy path
            args.request.hostname = TRANSLATE_CONFIG.translateProxyHostname;
            args.request.path = "/amazon-translate-proxy" + args.request.path;
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
    //   `${LOGGER_PREFIX} - getAmazonTranslateClient - Created new Translate client`
    // );
    return _amazonTranslateClient;
  } catch (error) {
    console.error(`${LOGGER_PREFIX} - initializeAwsServices - Error initializing AWS services:`, error);
    throw error;
  }
}

export async function translateText(fromLanguage, toLanguage, inputText) {
  if (isStringUndefinedNullEmpty(fromLanguage)) throw new Error("fromLanguage is required");
  if (isStringUndefinedNullEmpty(toLanguage)) throw new Error("toLanguage is required");
  if (isStringUndefinedNullEmpty(inputText)) throw new Error("inputText is required");

  const translateTextCommand = new TranslateTextCommand({
    Text: inputText,
    SourceLanguageCode: fromLanguage,
    TargetLanguageCode: toLanguage,
  });

  const amazonTranslateClient = await getAmazonTranslateClient();
  const response = await amazonTranslateClient.send(translateTextCommand);
  return response.TranslatedText;
}

export async function listTranslateLanguages() {
  const listLanguagesCommand = new ListLanguagesCommand({
    MaxResults: 500,
  });

  const amazonTranslateClient = await getAmazonTranslateClient();
  const response = await amazonTranslateClient.send(listLanguagesCommand);
  return response.Languages;
}
