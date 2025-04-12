// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { LOGGER_PREFIX } from "../constants";
import { isStringUndefinedNullEmpty } from "../utils/commonUtility";

export class AudioStreamManager {
  constructor(audioElement, audioContext) {
    this.audioContext = audioContext;
    this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
    this.audioElement = audioElement;

    // Set up permanent stream
    this.audioElement.srcObject = this.mediaStreamDestination.stream;
    // Store the audio track
    this.audioTrack = this.mediaStreamDestination.stream.getAudioTracks()[0];
    this.audioElement.play();

    // Queue for managing multiple audio requests
    this.audioQueue = [];
    this.isPlaying = false;

    this.audioFeedbackNode = null;
    this.shouldPlayAudioFeedback = false;

    this.microphoneStream = null;
    this.microphoneGain = null;
    this.isMicrophoneActive = false;
    this.activeMicrophoneDeviceId;

    this.customFeedbackBuffer = null;
  }

  async startMicrophone(microphoneConstraints) {
    try {
      const microphoneDeviceId = microphoneConstraints?.audio?.deviceId;
      if (microphoneDeviceId == null) throw new Error("Microphone deviceId not provided!");

      if (this.isMicrophoneActive) {
        if (this.activeMicrophoneDeviceId === microphoneDeviceId) {
          console.info(`${LOGGER_PREFIX} - Microphone [${microphoneDeviceId}] already active`);
          return;
        } else {
          this.stopMicrophone();
        }
      }

      // Get microphone stream
      this.activeMicrophoneDeviceId = microphoneDeviceId;
      const stream = await navigator.mediaDevices.getUserMedia(microphoneConstraints);

      // Create source from microphone
      const micSource = this.audioContext.createMediaStreamSource(stream);

      // Create gain node for microphone volume control
      this.microphoneGain = this.audioContext.createGain();
      this.microphoneGain.gain.setValueAtTime(1.0, this.audioContext.currentTime);

      // Connect microphone through gain to destination
      micSource.connect(this.microphoneGain);
      this.microphoneGain.connect(this.mediaStreamDestination);

      // Store stream for cleanup
      this.microphoneStream = stream;
      this.isMicrophoneActive = true;

      console.info(`${LOGGER_PREFIX} - Microphone started successfully`);
    } catch (error) {
      console.error(`${LOGGER_PREFIX} - Error starting microphone:`, error);
      throw error;
    }
  }

  stopMicrophone() {
    if (!this.isMicrophoneActive) return;

    if (this.microphoneStream) {
      // Stop all audio tracks
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }

    if (this.microphoneGain) {
      this.microphoneGain.disconnect();
      this.microphoneGain = null;
    }

    this.isMicrophoneActive = false;
    this.activeMicrophoneDeviceId = null;
    console.info(`${LOGGER_PREFIX} - Microphone stopped`);
  }

  setMicrophoneVolume(volume) {
    if (this.microphoneGain && volume >= 0 && volume <= 1) {
      this.microphoneGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }

  isMicrophoneEnabled() {
    return this.isMicrophoneActive;
  }

  async loadAudioFile(filePath) {
    try {
      if (isStringUndefinedNullEmpty(filePath)) throw new Error("Invalid file path");

      const response = await fetch(filePath);
      let reader = response.body.getReader();
      let chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      let blob = new Blob(chunks);
      let arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      return audioBuffer;
    } catch (error) {
      console.error(`${LOGGER_PREFIX} - Error loading audio file:`, error);
      throw error;
    }
  }

  // Create audio feedback
  createAudioFeedback() {
    if (this.customFeedbackBuffer) {
      const audioFeedback = this.audioContext.createBufferSource();
      audioFeedback.buffer = this.customFeedbackBuffer;
      audioFeedback.loop = true;

      // Add gain node to control volume
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0.05; // Adjust volume here (0-1)

      audioFeedback.connect(gainNode);
      gainNode.connect(this.mediaStreamDestination);
      return audioFeedback;
    }

    const bufferSize = 2 * this.audioContext.sampleRate;
    const audioFeedbackBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = audioFeedbackBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const audioFeedback = this.audioContext.createBufferSource();
    audioFeedback.buffer = audioFeedbackBuffer;
    audioFeedback.loop = true;

    // Add gain node to control volume
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0.005; // Adjust volume here (0-1)

    audioFeedback.connect(gainNode);
    gainNode.connect(this.mediaStreamDestination);

    console.info(`${LOGGER_PREFIX} - createAudioFeedback - white noise:`, audioFeedback);
    return audioFeedback;
  }

  startAudioFeedback() {
    //console.info(`${LOGGER_PREFIX} - startAudioFeedback`);
    if (!this.audioFeedbackNode) {
      this.audioFeedbackNode = this.createAudioFeedback();
      this.audioFeedbackNode.start();
    }
  }

  stopAudioFeedback() {
    if (this.audioFeedbackNode) {
      //console.info(`${LOGGER_PREFIX} - stopAudioFeedback`);
      this.audioFeedbackNode.stop();
      this.audioFeedbackNode = null;
    }
  }

  async enableAudioFeedback(filePath = null) {
    if (filePath != null) {
      try {
        this.customFeedbackBuffer = await this.loadAudioFile(filePath);
      } catch (error) {
        console.error(`${LOGGER_PREFIX} - Failed to load custom audio feedback:`, error);
        this.customFeedbackBuffer = null;
        // Continue with default white noise
      }
    } else {
      this.customFeedbackBuffer = null;
    }

    console.info(`${LOGGER_PREFIX} - enableAudioFeedback`);
    this.shouldPlayAudioFeedback = true;
    if (!this.isPlaying) {
      this.startAudioFeedback();
    }
  }

  disableAudioFeedback() {
    console.info(`${LOGGER_PREFIX} - disableAudioFeedback`);
    this.shouldPlayAudioFeedback = false;
    this.stopAudioFeedback();
  }

  // Getter for the audio track
  getAudioTrack() {
    return this.audioTrack;
  }

  async playAudio(audioData, volume = 1.0) {
    return new Promise(async (resolve, reject) => {
      try {
        const audioDataArray = await audioData.transformToByteArray();
        const audioBuffer = await this.audioContext.decodeAudioData(audioDataArray.buffer);

        // Add to queue
        this.audioQueue.push({
          buffer: audioBuffer,
          volume: volume,
          resolve: resolve,
        });

        // Start processing queue if not already playing
        if (!this.isPlaying) {
          this.processQueue();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async playAudioBuffer(audioDataArray, volume = 1.0) {
    return new Promise(async (resolve, reject) => {
      try {
        const audioBuffer = await this.audioContext.decodeAudioData(audioDataArray.buffer);

        // Add to queue
        this.audioQueue.push({
          buffer: audioBuffer,
          volume: volume,
          resolve: resolve,
        });

        // Start processing queue if not already playing
        if (!this.isPlaying) {
          this.processQueue();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async processQueue() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      // Start audio feedback when queue is empty
      if (this.shouldPlayAudioFeedback) {
        this.startAudioFeedback();
      }
      return;
    }

    // Stop audio feedback when there's something to play
    this.stopAudioFeedback();

    this.isPlaying = true;
    const current = this.audioQueue.shift();

    // Create and set up source
    const bufferSource = this.audioContext.createBufferSource();
    bufferSource.buffer = current.buffer;

    // Create gain node for volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = current.volume; // Set the volume (0.0 to 1.0)

    bufferSource.connect(gainNode);
    gainNode.connect(this.mediaStreamDestination);

    //bufferSource.connect(this.mediaStreamDestination);

    // Handle completion
    bufferSource.onended = () => {
      current.resolve();
      this.processQueue();
    };

    // Start playing
    bufferSource.start();
  }

  async resume() {
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  async suspend() {
    if (this.audioContext.state === "running") {
      await this.audioContext.suspend();
    }
  }

  clearQueue() {
    this.audioQueue = [];
  }

  getState() {
    return {
      contextState: this.audioContext.state,
      queueLength: this.audioQueue.length,
      isPlaying: this.isPlaying,
      currentTime: this.audioContext.currentTime,
    };
  }

  //Clean up resources
  async dispose() {
    console.info(`${LOGGER_PREFIX} - dispose - AudioStreamManager disposed`);
    this.clearQueue();
    this.stopAudioFeedback();
    this.stopMicrophone();
    if (this.audioTrack != null) {
      this.audioTrack.stop();
    }
  }

  // Mute methods
  muteTrack() {
    if (this.audioTrack) {
      this.audioTrack.enabled = false;
    }
  }

  unmuteTrack() {
    if (this.audioTrack) {
      this.audioTrack.enabled = true;
    }
  }

  toggleTrackMute() {
    if (this.audioTrack) {
      this.audioTrack.enabled = !this.audioTrack.enabled;
    }
  }

  isTrackMuted() {
    return this.audioTrack ? !this.audioTrack.enabled : true;
  }

  muteAudioElement() {
    if (this.audioElement) {
      this.audioElement.muted = true;
    }
  }

  unmuteAudioElement() {
    if (this.audioElement) {
      this.audioElement.muted = false;
    }
  }

  toggleAudioElementMute() {
    if (this.audioElement) {
      this.audioElement.muted = !this.audioElement.muted;
    }
  }

  isAudioElementMuted() {
    return this.audioElement ? this.audioElement.muted : true;
  }
}
