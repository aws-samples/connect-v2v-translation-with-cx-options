export class AudioInputTestManager {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.audioInputStream = null;
    this.audioInputStreamSource = null;
    this.analyser = null;
    this.isTestRunning = false;
    this.animationFrameId = null;
    this.volumeBarElement = null;
  }

  async startAudioTest(audioInputStream, volumeBarElement) {
    this.audioInputStream = audioInputStream;
    this.volumeBarElement = volumeBarElement;

    this.analyser = this.audioContext.createAnalyser();
    this.audioInputStreamSource = this.audioContext.createMediaStreamSource(this.audioInputStream);
    this.audioInputStreamSource.connect(this.analyser);

    this.analyser.fftSize = 256;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      if (!this.isTestRunning) return;

      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;

      const volumePercentage = Math.min((average / 255) * 100, 100);
      volumeBarElement.style.width = `${volumePercentage}%`;

      this.animationFrameId = requestAnimationFrame(updateVolume);
    };

    this.isTestRunning = true;
    updateVolume();
  }

  stopAudioTest() {
    if (!this.isTestRunning) return;

    // Cancel the animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop all tracks in the stream
    if (this.audioInputStream) {
      this.audioInputStream.getTracks().forEach((track) => track.stop());
      this.audioInputStream = null;
    }

    // Disconnect the audio source
    if (this.audioInputStreamSource) {
      this.audioInputStreamSource.disconnect();
      this.audioInputStreamSource = null;
    }

    // Reset the analyser
    this.analyser = null;

    // Reset the volume bar
    if (this.volumeBarElement) {
      volumeBar.style.width = "0%";
    }

    this.isTestRunning = false;
  }

  isRunning() {
    return this.isTestRunning;
  }
}
