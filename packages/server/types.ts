import { IChallenge } from './mongodb/models/challenges';

export interface SubmissionConfig {
  challenge: IChallenge;
  network: string;
  contractAddress: string;
}
