import React, { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import * as Tone from 'tone';

const instruments = {
  piano: new Tone.Sampler({
    urls: {
      C4: "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      A4: "A4.mp3",
    },
    baseUrl: "https://tonejs.github.io/audio/salamander/",
  }).toDestination(),
  synth: new Tone.PolySynth().toDestination(),
  marimba: new Tone.Sampler({
    urls: {
      C4: "C4.mp3",
    },
    baseUrl: "https://tonejs.github.io/audio/marimba/",
  }).toDestination(),
};

const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
const chords = {
  'C': ['C4', 'E4', 'G4'],
  'F': ['F4', 'A4', 'C5'],
  'G': ['G4', 'B4', 'D5'],
};

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [selectedInstrument, setSelectedInstrument] = useState('piano');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNote, setCurrentNote] = useState('');
  const [mode, setMode] = useState('single'); // 'single' or 'chord'
  const lastPlayedNote = useRef(null);
  const lastPlayTime = useRef(0);

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current });
        },
        width: 640,
        height: 480
      });
      camera.start();
    }

    return () => {
      hands.close();
    };
  }, []);

  const calculateFingerState = (landmarks) => {
    const fingerTips = [8, 12, 16, 20]; // Index, middle, ring, pinky fingertips
    const fingerMids = [7, 11, 15, 19]; // Corresponding middle joints
    const fingerStates = fingerTips.map((tip, i) => {
      const tipY = landmarks[tip].y;
      const midY = landmarks[fingerMids[i]].y;
      return tipY < midY;
    });
    return fingerStates;
  };

  const detectGesture = (landmarks, fingerStates) => {
    // Thumb position relative to index finger base
    const thumbTip = landmarks[4];
    const indexBase = landmarks[5];
    const isThumbUp = thumbTip.y < indexBase.y;

    // Count raised fingers
    const raisedFingers = fingerStates.filter(state => state).length;

    // Detect if fingers are spread apart
    const spreadDistance = Math.abs(landmarks[8].x - landmarks[20].x);
    const isSpread = spreadDistance > 0.3;

    return {
      isThumbUp,
      raisedFingers,
      isSpread
    };
  };

  const onResults = (results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const fingerStates = calculateFingerState(landmarks);
      const gesture = detectGesture(landmarks, fingerStates);
      
      // Hand height for pitch
      const avgHeight = 1 - landmarks[9].y; // Using palm center for stability
      const noteIndex = Math.floor(avgHeight * notes.length);
      const note = notes[Math.min(noteIndex, notes.length - 1)];

      // Volume based on hand's z-coordinate (depth)
      const volume = Math.max(0.3, Math.min(1, 1 - landmarks[9].z));
      
      const now = Date.now();
      if (now - lastPlayTime.current > 150) { // Increased debounce time
        const instrument = instruments[selectedInstrument];
        
        if (gesture.isThumbUp && gesture.raisedFingers >= 3) {
          // Play chord when thumb up and 3+ fingers raised
          const chordNotes = chords[note[0]] || chords['C'];
          instrument.triggerAttackRelease(chordNotes, "8n", undefined, volume);
          setCurrentNote(`${note[0]} chord`);
        } else if (gesture.raisedFingers > 0) {
          // Play single note when any finger is raised
          instrument.triggerAttackRelease(note, "8n", undefined, volume);
          setCurrentNote(note);
        }

        lastPlayedNote.current = note;
        lastPlayTime.current = now;
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(false);
      setCurrentNote('');
    }
  };

  return (
    <div>
      <h1>Hand Music Player</h1>
      <div className="video-container">
        <video ref={videoRef} width="640" height="480" />
        <canvas ref={canvasRef} width="640" height="480" />
      </div>
      <div className="controls">
        <select 
          value={selectedInstrument} 
          onChange={(e) => setSelectedInstrument(e.target.value)}
        >
          <option value="piano">Piano</option>
          <option value="synth">Synth</option>
          <option value="marimba">Marimba</option>
        </select>
      </div>
      <div className="status">
        <div className="current-note">
          {currentNote ? `Playing: ${currentNote}` : 'Ready to play'}
        </div>
        <div className="instructions">
          <h3>How to Play:</h3>
          <ul>
            <li>Raise your hand to play notes</li>
            <li>Move your hand up/down to change pitch</li>
            <li>Move your hand closer/further to control volume</li>
            <li>Raise thumb + 3 fingers for chord mode</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
