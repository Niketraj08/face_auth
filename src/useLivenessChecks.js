import { useState, useCallback, useRef } from 'react';

const useLivenessChecks = () => {
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [headTurnDetected, setHeadTurnDetected] = useState(false);
  const [smileDetected, setSmileDetected] = useState(false);
  const [currentAction, setCurrentAction] = useState('face_detection'); // face_detection, blink, head_turn, smile, complete
  const [actionProgress, setActionProgress] = useState(0);
  const [actionStartTime, setActionStartTime] = useState(null);

  const blinkHistoryRef = useRef([]);
  const headPositionHistoryRef = useRef([]);

  // MediaPipe face landmarks indices
  const LEFT_EYE_TOP = 159;
  const LEFT_EYE_BOTTOM = 145;
  const LEFT_EYE_LEFT = 33;
  const LEFT_EYE_RIGHT = 133;

  const RIGHT_EYE_TOP = 386;
  const RIGHT_EYE_BOTTOM = 374;
  const RIGHT_EYE_LEFT = 362;
  const RIGHT_EYE_RIGHT = 263;

  const NOSE_TIP = 1;
  const LEFT_EAR = 234;
  const RIGHT_EAR = 454;

  const MOUTH_LEFT = 61;
  const MOUTH_RIGHT = 291;
  const MOUTH_TOP = 13;
  const MOUTH_BOTTOM = 14;

  const calculateEyeAspectRatio = useCallback((landmarks, eyePoints) => {
    const [top, bottom, left, right] = eyePoints.map(idx => landmarks[idx]);

    // Calculate distances
    const vertical1 = Math.sqrt(
      Math.pow(top.x - bottom.x, 2) + Math.pow(top.y - bottom.y, 2)
    );
    const vertical2 = Math.sqrt(
      Math.pow(landmarks[eyePoints[0]].x - landmarks[eyePoints[1]].x, 2) +
      Math.pow(landmarks[eyePoints[0]].y - landmarks[eyePoints[1]].y, 2)
    );

    const horizontal = Math.sqrt(
      Math.pow(left.x - right.x, 2) + Math.pow(left.y - right.y, 2)
    );

    const ear = (vertical1 + vertical2) / (2 * horizontal);
    return ear;
  }, []);

  const detectBlink = useCallback((landmarks) => {
    if (!landmarks) return false;

    const leftEAR = calculateEyeAspectRatio(landmarks, [
      LEFT_EYE_TOP, LEFT_EYE_BOTTOM, LEFT_EYE_LEFT, LEFT_EYE_RIGHT
    ]);

    const rightEAR = calculateEyeAspectRatio(landmarks, [
      RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM, RIGHT_EYE_LEFT, RIGHT_EYE_RIGHT
    ]);

    const avgEAR = (leftEAR + rightEAR) / 2;

    // Add to history for smoothing
    blinkHistoryRef.current.push(avgEAR);
    if (blinkHistoryRef.current.length > 10) {
      blinkHistoryRef.current.shift();
    }

    // Calculate average EAR
    const avgHistoryEAR = blinkHistoryRef.current.reduce((a, b) => a + b, 0) / blinkHistoryRef.current.length;

    // Blink threshold (eye closed)
    const blinkThreshold = 0.25;

    return avgHistoryEAR < blinkThreshold;
  }, [calculateEyeAspectRatio]);

  const detectHeadTurn = useCallback((landmarks) => {
    if (!landmarks) return false;

    const nose = landmarks[NOSE_TIP];
    const leftEar = landmarks[LEFT_EAR];
    const rightEar = landmarks[RIGHT_EAR];

    // Calculate head orientation based on ear positions relative to nose
    const leftDistance = Math.sqrt(
      Math.pow(nose.x - leftEar.x, 2) + Math.pow(nose.y - leftEar.y, 2)
    );
    const rightDistance = Math.sqrt(
      Math.pow(nose.x - rightEar.x, 2) + Math.pow(nose.y - rightEar.y, 2)
    );

    // If one ear is significantly closer than the other, head is turned
    const ratio = leftDistance / rightDistance;
    const turnThreshold = 1.3; // 30% difference

    return ratio > turnThreshold || ratio < (1 / turnThreshold);
  }, []);

  const detectSmile = useCallback((landmarks) => {
    if (!landmarks) return false;

    const mouthLeft = landmarks[MOUTH_LEFT];
    const mouthRight = landmarks[MOUTH_RIGHT];
    const mouthTop = landmarks[MOUTH_TOP];
    const mouthBottom = landmarks[MOUTH_BOTTOM];

    // Calculate mouth width and height
    const mouthWidth = Math.sqrt(
      Math.pow(mouthLeft.x - mouthRight.x, 2) + Math.pow(mouthLeft.y - mouthRight.y, 2)
    );

    const mouthHeight = Math.sqrt(
      Math.pow(mouthTop.x - mouthBottom.x, 2) + Math.pow(mouthTop.y - mouthBottom.y, 2)
    );

    // Smile ratio (width to height)
    const smileRatio = mouthWidth / mouthHeight;

    // Smile threshold
    return smileRatio > 2.5;
  }, []);

  const checkLivenessAction = useCallback((landmarks) => {
    if (!landmarks) return;

    const currentTime = Date.now();

    // Initialize action start time
    if (!actionStartTime) {
      setActionStartTime(currentTime);
      console.log('Initializing liveness checks, current action:', currentAction);
      return;
    }

    // Require minimum 500ms per action for enhanced user experience
    if (currentTime - actionStartTime < 500) {
      return;
    }

    console.log('Checking liveness action:', currentAction);

    switch (currentAction) {
      case 'face_detection':
        // Face is already detected, move to next action after minimum time
        console.log('Moving from face_detection to blink');
        setCurrentAction('blink');
        setActionProgress(25);
        setActionStartTime(currentTime);
        break;

      case 'blink':
        if (detectBlink(landmarks)) {
          console.log('Blink detected, moving to head_turn');
          setBlinkDetected(true);
          setCurrentAction('head_turn');
          setActionProgress(50);
          setActionStartTime(currentTime);
        }
        break;

      case 'head_turn':
        if (detectHeadTurn(landmarks)) {
          console.log('Head turn detected, moving to smile');
          setHeadTurnDetected(true);
          setCurrentAction('smile');
          setActionProgress(75);
          setActionStartTime(currentTime);
        }
        break;

      case 'smile':
        if (detectSmile(landmarks)) {
          console.log('Smile detected, completing liveness check');
          setSmileDetected(true);
          setCurrentAction('complete');
          setActionProgress(100);
          setActionStartTime(null);
        }
        break;

      default:
        console.log('Unknown action:', currentAction);
        break;
    }
  }, [currentAction, actionStartTime, detectBlink, detectHeadTurn, detectSmile]);

  const resetChecks = useCallback(() => {
    setBlinkDetected(false);
    setHeadTurnDetected(false);
    setSmileDetected(false);
    setCurrentAction('face_detection');
    setActionProgress(0);
    setActionStartTime(null);
    blinkHistoryRef.current = [];
    headPositionHistoryRef.current = [];
  }, []);

  const getActionInstruction = useCallback(() => {
    const instruction = (() => {
      switch (currentAction) {
        case 'face_detection':
          return '📸 Position your face clearly in the camera frame';
        case 'blink':
          return '👁️ Please blink your eyes naturally to prove liveness';
        case 'head_turn':
          return '↩️ Turn your head slowly to the left or right';
        case 'smile':
          return '😊 Please smile for the camera to complete verification';
        case 'complete':
          return '✅ Liveness verification successful! Processing results...';
        default:
          return '🔧 Initializing Aadhaar face authentication system...';
      }
    })();

    console.log('Current action:', currentAction, 'Instruction:', instruction);
    return instruction;
  }, [currentAction]);

  return {
    blinkDetected,
    headTurnDetected,
    smileDetected,
    currentAction,
    actionProgress,
    checkLivenessAction,
    resetChecks,
    getActionInstruction,
    isComplete: currentAction === 'complete'
  };
};

export default useLivenessChecks;
