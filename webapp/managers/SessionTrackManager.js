// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { LOGGER_PREFIX } from "../constants";
import { isStringUndefinedNullEmpty } from "../utils/commonUtility";

// Enum for track types
export const TrackType = {
  FILE: "FILE",
  MIC: "MIC",
  POLLY: "POLLY",
  SILENT: "SILENT",
};

export class SessionTrackManager {
  constructor(peerConnection, audioContext) {
    this.peerConnection = peerConnection;
    this.audioContext = audioContext;
    this.currentTrackType = null;
    this.currentTrack = null;
    this.micStream = null;
    this.silentTrack = null;
  }

  // Create a silent audio track
  createSilentTrack() {
    const silentStream = this.audioContext.createMediaStreamDestination().stream;
    const silentTrack = silentStream.getAudioTracks()[0];
    return silentTrack;
  }

  // Get microphone access and create track
  async createMicTrack(microphoneConstraints) {
    const micStream = await navigator.mediaDevices.getUserMedia(microphoneConstraints);

    const micStreamAudioTrack = micStream.getAudioTracks()[0];
    return micStreamAudioTrack;
  }

  // Create track from file
  createFileTrack(inputFilePath) {
    if (isStringUndefinedNullEmpty(inputFilePath)) throw new Error("Invalid input file path");

    const audio = new Audio(inputFilePath);
    audio.loop = false;
    audio.crossOrigin = "anonymous";
    audio.play();

    const mediaStreamDestination = this.audioContext.createMediaStreamDestination();
    const mediaElementSource = this.audioContext.createMediaElementSource(audio);
    mediaElementSource.connect(mediaStreamDestination);
    const fileStream = mediaStreamDestination.stream;

    const fileStreamAudioTrack = fileStream.getAudioTracks()[0];
    return fileStreamAudioTrack;
  }

  // Replace the current track with a new one
  async replaceTrack(newTrack, newTrackType) {
    // If same track type and we already have a track, do nothing
    if (this.currentTrackType === newTrackType && this.currentTrack) {
      // console.info(
      //   `${LOGGER_PREFIX} - replaceTrack - Track of type ${newTrackType} already active`
      // );
      return;
    }

    // Clean up existing track if necessary
    await this.cleanupCurrentTrack();

    try {
      this.currentTrackType = newTrackType;
      this.currentTrack = newTrack;
      this.replaceAudioSenderTrack(newTrack);
      return;
    } catch (error) {
      console.error(`${LOGGER_PREFIX} - replaceTrack - Error replacing track:`, error);
      // Fallback to silent track on error
      this.currentTrackType = TrackType.SILENT;
      this.currentTrack = this.silentTrack;
      this.replaceAudioSenderTrack(this.silentTrack);
      return;
    }
  }

  // Clean up the current track
  async cleanupCurrentTrack() {
    if (this.currentTrack) {
      this.currentTrack.stop();
      if (this.currentTrackType === TrackType.MIC && this.micStream) {
        this.micStream.getTracks().forEach((track) => track.stop());
        this.micStream = null;
      }
    }
  }

  // Get current track info
  getCurrentTrackInfo() {
    return {
      type: this.currentTrackType,
      track: this.currentTrack,
      isActive: this.currentTrack ? this.currentTrack.enabled : false,
    };
  }

  // Enable/disable the current track
  setTrackEnabled(enabled) {
    if (this.currentTrack) {
      this.currentTrack.enabled = enabled;
    }
  }

  // Clean up resources
  async dispose() {
    await this.cleanupCurrentTrack();
    if (this.silentTrack) {
      this.silentTrack.stop();
    }
    console.info(`${LOGGER_PREFIX} - dispose - SessionTrackManager disposed`);
  }

  //Replace Audio Sender Track in PeerConnection
  async replaceAudioSenderTrack(newTrack) {
    if (this.peerConnection == null) {
      console.error(`${LOGGER_PREFIX} - replaceAudioSenderTrack - peerConnection is null`);
      return;
    }
    const senders = this.peerConnection.getSenders();
    if (senders == null) {
      console.error(`${LOGGER_PREFIX} - replaceAudioSenderTrack - senders is null`);
      return;
    }

    const audioSender = senders?.find((sender) => sender.track.kind === "audio");

    if (audioSender == null) {
      console.info(`${LOGGER_PREFIX} - replaceAudioSenderTrack - adding a new track`);
      this.peerConnection.addTrack(newTrack);
      return;
    }

    console.info(`${LOGGER_PREFIX} - replaceAudioSenderTrack - replacing existing track`);
    await audioSender.replaceTrack(newTrack);
  }
}
