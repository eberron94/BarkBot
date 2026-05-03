import { Post } from './Post.js';

export class PostState {
    constructor(data = {}) {
        const postSource = data.post || data;
        this.post =
            postSource instanceof Post ? postSource : new Post(postSource);

        const stateSource = data.curState || data;
        this.curState = {
            // UI State Machine
            isAddingPreset: stateSource.isAddingPreset || false,
            isScheduling: stateSource.isScheduling || false,
            isEditingPresetName: stateSource.isEditingPresetName || null,
            isAddingAltText: stateSource.isAddingAltText || false,
            isAddingTags: stateSource.isAddingTags || false,
            isEditing: stateSource.isEditing || false,

            // Post state
            countdownTimer: stateSource.countdownTimer || null,
            targetAction: stateSource.targetAction || null,
        };
    }
}
