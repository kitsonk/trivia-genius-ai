export interface TriviaQuestion {
  question: string;
  answer: string;
  context?: string;
}

export enum GameMode {
  SETUP = 'SETUP',
  LOADING = 'LOADING',
  PLAY_LIVE = 'PLAY_LIVE',
  PLAY_STANDARD = 'PLAY_STANDARD',
  GAME_OVER = 'GAME_OVER'
}

export enum HostPersonality {
  SARCASTIC_ROBOT = 'Sarcastic Robot',
  ENTHUSIASTIC_HOST = 'Enthusiastic Game Show Host',
  STRICT_PROFESSOR = 'Strict History Professor',
  CHILL_SURFER = 'Chill Surfer Dude'
}

export interface GameState {
  mode: GameMode;
  topic: string;
  personality: HostPersonality;
  questions: TriviaQuestion[];
  score: number;
  currentQuestionIndex: number;
}

export interface AudioConfig {
  sampleRate: number;
  numChannels: number;
}