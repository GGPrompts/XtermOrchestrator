/**
 * Voice Recognition Component - Windows 11 Speech Recognition Integration
 * 
 * This component provides voice-to-text functionality using the Web Speech API
 * and Windows 11 native speech recognition capabilities.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './VoiceRecognition.module.css';

interface VoiceRecognitionProps {
    onSpeechResult: (text: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
    className?: string;
    autoStart?: boolean;
}

interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionError extends Event {
    error: string;
    message: string;
}

// Type declarations for Web Speech API
declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    serviceURI: string;
    grammars: any; // SpeechGrammarList type not well supported
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((event: Event) => void) | null;
    onend: ((event: Event) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionError) => void) | null;
    onnomatch: ((event: Event) => void) | null;
    onspeechstart: ((event: Event) => void) | null;
    onspeechend: ((event: Event) => void) | null;
    onsoundstart: ((event: Event) => void) | null;
    onsoundend: ((event: Event) => void) | null;
    onaudiostart: ((event: Event) => void) | null;
    onaudioend: ((event: Event) => void) | null;
}

export default function VoiceRecognition({ 
    onSpeechResult, 
    onError, 
    className = '', 
    autoStart = false 
}: VoiceRecognitionProps) {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [confidence, setConfidence] = useState(0);
    const [volume, setVolume] = useState(0);
    
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number>();

    /**
     * Initialize speech recognition
     */
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            setIsSupported(true);
            
            const recognition = new SpeechRecognition();
            
            // Configure for Windows 11 optimal settings
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US'; // Can be made configurable
            recognition.maxAlternatives = 3;

            // Event handlers
            recognition.onstart = () => {
                console.log('🎤 Voice recognition started');
                setIsListening(true);
                startVolumeMonitoring();
            };

            recognition.onend = () => {
                console.log('🎤 Voice recognition ended');
                setIsListening(false);
                setCurrentTranscript('');
                setVolume(0);
                stopVolumeMonitoring();
            };

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const transcript = result[0].transcript;
                    const confidence = result[0].confidence;

                    if (result.isFinal) {
                        finalTranscript += transcript;
                        setConfidence(confidence);
                        console.log('🎯 Final speech result:', transcript, 'Confidence:', confidence);
                    } else {
                        interimTranscript += transcript;
                    }
                }

                const currentText = finalTranscript || interimTranscript;
                setCurrentTranscript(currentText);

                if (finalTranscript) {
                    onSpeechResult(finalTranscript, true);
                } else if (interimTranscript) {
                    onSpeechResult(interimTranscript, false);
                }
            };

            recognition.onerror = (event: SpeechRecognitionError) => {
                console.error('🎤 Speech recognition error:', event.error, event.message);
                const errorMessage = `Speech recognition error: ${event.error}`;
                onError?.(errorMessage);
                setIsListening(false);
                stopVolumeMonitoring();
            };

            recognition.onnomatch = () => {
                console.warn('🎤 No speech was recognized');
                onError?.('No speech was recognized');
            };

            recognitionRef.current = recognition;

            // Auto-start if requested
            if (autoStart) {
                startListening();
            }
        } else {
            console.warn('🎤 Speech recognition not supported in this browser');
            setIsSupported(false);
            onError?.('Speech recognition not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
            stopVolumeMonitoring();
        };
    }, [autoStart, onSpeechResult, onError]);

    /**
     * Start volume monitoring for visual feedback
     */
    const startVolumeMonitoring = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
            
            microphoneRef.current.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;
            
            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            const updateVolume = () => {
                if (analyserRef.current && isListening) {
                    analyserRef.current.getByteFrequencyData(dataArray);
                    
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / bufferLength;
                    const volumeLevel = Math.min(average / 128, 1);
                    
                    setVolume(volumeLevel);
                    animationFrameRef.current = requestAnimationFrame(updateVolume);
                }
            };
            
            updateVolume();
        } catch (error) {
            console.error('🎤 Failed to access microphone:', error);
            onError?.('Failed to access microphone. Please check permissions.');
        }
    }, [isListening, onError]);

    /**
     * Stop volume monitoring
     */
    const stopVolumeMonitoring = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setVolume(0);
    }, []);

    /**
     * Start listening
     */
    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            try {
                recognitionRef.current.start();
            } catch (error) {
                console.error('🎤 Failed to start recognition:', error);
                onError?.('Failed to start voice recognition');
            }
        }
    }, [isListening, onError]);

    /**
     * Stop listening
     */
    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
    }, [isListening]);

    /**
     * Toggle listening state
     */
    const toggleListening = useCallback(() => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [isListening, startListening, stopListening]);

    if (!isSupported) {
        return (
            <div className={`${styles.voiceRecognition} ${styles.unsupported} ${className}`}>
                <div className={styles.errorMessage}>
                    <span className={styles.errorIcon}>⚠️</span>
                    <div>
                        <div className={styles.errorTitle}>Speech Recognition Not Supported</div>
                        <div className={styles.errorSubtitle}>
                            Please use Chrome, Edge, or another Chromium-based browser for voice input.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.voiceRecognition} ${className}`}>
            <div className={styles.voiceControls}>
                <button
                    onClick={toggleListening}
                    className={`${styles.micButton} ${isListening ? styles.listening : ''}`}
                    title={isListening ? 'Stop voice recognition' : 'Start voice recognition'}
                >
                    <div className={styles.micIcon}>
                        {isListening ? '🎤' : '🎙️'}
                    </div>
                    <div 
                        className={styles.volumeIndicator}
                        style={{ 
                            transform: `scale(${1 + volume * 0.5})`,
                            opacity: isListening ? 0.7 + volume * 0.3 : 0.3
                        }}
                    />
                </button>
                
                <div className={styles.statusInfo}>
                    <div className={styles.statusText}>
                        {isListening ? '🟢 Listening...' : '⚫ Click to speak'}
                    </div>
                    {confidence > 0 && (
                        <div className={styles.confidenceIndicator}>
                            Confidence: {Math.round(confidence * 100)}%
                        </div>
                    )}
                </div>
            </div>

            {currentTranscript && (
                <div className={styles.transcriptDisplay}>
                    <div className={styles.transcriptLabel}>Voice Input:</div>
                    <div className={styles.transcriptText}>{currentTranscript}</div>
                </div>
            )}

            <div className={styles.shortcuts}>
                <div className={styles.shortcutItem}>
                    <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd> Toggle Voice
                </div>
            </div>
        </div>
    );
}