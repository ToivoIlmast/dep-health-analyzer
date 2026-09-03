import { IConfig } from 'app/config/types';

export type RegressionAIConfig = NonNullable<NonNullable<IConfig['features']>['regression']>['ai'];

export interface RegressionPromptData {
    observations: {
        primaryAreas?: string[];
        topHotspots?: {
            source: string;
            dependencyCount: number;
        }[];
        areasConnectedByNewDependencies?: string[];
        deepInternalSources?: string[];
    };
}
