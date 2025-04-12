// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Buffer } from "buffer";
import MicrophoneStream from "microphone-stream";

export function encodePCMChunk(chunk) {
  const input = MicrophoneStream.toRaw(chunk);
  let offset = 0;
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return Buffer.from(buffer);
}

//Creates Agent Mic Stream, used as input for Amazon Transcribe when transcribing agent's voice
export async function createMicrophoneStream(microphoneConstraints) {
  const micStream = new MicrophoneStream();
  micStream.setStream(await navigator.mediaDevices.getUserMedia(microphoneConstraints));
  return micStream;
}

export const getTranscribeMicStream = async function* (amazonTranscribeMicStream, sampleRate) {
  for await (const chunk of amazonTranscribeMicStream) {
    if (chunk.length <= sampleRate) {
      const encodedChunk = encodePCMChunk(chunk);
      yield {
        AudioEvent: {
          AudioChunk: encodedChunk,
        },
      };
    }
  }
};

export const getTranscribeAudioStream = async function* (amazonTranscribeAudioStream, sampleRate) {
  for await (const chunk of amazonTranscribeAudioStream) {
    if (chunk.length <= sampleRate) {
      const encodedChunk = encodePCMChunk(chunk);
      yield {
        AudioEvent: {
          AudioChunk: encodedChunk,
        },
      };
    }
  }
};
