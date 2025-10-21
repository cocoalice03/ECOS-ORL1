/**
 * Emotional State Service
 *
 * Manages dynamic emotional state for virtual patients
 * - Tracks patient agitation levels (0-100)
 * - Analyzes student response quality
 * - Provides behavioral instructions based on emotional state
 * - Scenario-specific emotional progression
 */

export interface EmotionalState {
  agitationLevel: number; // 0-100
  lastUpdate: Date;
  triggerEvents: Array<{
    timestamp: Date;
    event: string;
    change: number; // +/- agitation change
  }>;
}

export interface ResponseAnalysis {
  isAdaptive: boolean;
  score: number; // 0-100 (quality of response)
  factors: {
    empathy: number;
    appropriateQuestions: number;
    reassurance: number;
    avoidanceOfJudgment: number;
  };
  agitationChange: number; // How much to adjust agitation (-20 to +20)
}

export class EmotionalStateService {
  private readonly SCENARIO_CONFIGS = {
    4: { // Psychiatric episode scenario
      initialAgitation: 30, // Méfiant mais pas agressif
      maxAgitation: 100,
      minAgitation: 0,
      thresholds: {
        calm: 30,        // 0-30: Calme, coopératif
        nervous: 60,     // 30-60: Nerveux, méfiant
        agitated: 80,    // 60-80: Agité, hostile
        aggressive: 100  // 80-100: Agressif, refuse de coopérer
      }
    }
  };

  /**
   * Initialize emotional state for a scenario
   */
  initializeEmotionalState(scenarioId: number): EmotionalState {
    const config = this.SCENARIO_CONFIGS[scenarioId];

    if (!config) {
      // Default for non-configured scenarios
      return {
        agitationLevel: 0,
        lastUpdate: new Date(),
        triggerEvents: []
      };
    }

    return {
      agitationLevel: config.initialAgitation,
      lastUpdate: new Date(),
      triggerEvents: [{
        timestamp: new Date(),
        event: 'Initialization',
        change: 0
      }]
    };
  }

  /**
   * Analyze student response quality for psychiatric scenarios
   */
  analyzeResponseQuality(
    studentMessage: string,
    scenarioId: number
  ): ResponseAnalysis {
    const lowerMessage = studentMessage.toLowerCase();

    // Initialize scores
    let empathy = 0;
    let appropriateQuestions = 0;
    let reassurance = 0;
    let avoidanceOfJudgment = 0;

    // EMPATHY ANALYSIS (0-25 points)
    const empathyPhrases = [
      'je comprends', 'c\'est difficile', 'je vous écoute',
      'ça doit être', 'je suis là', 'prenez votre temps',
      'comment vous sentez', 'je vous crois', 'c\'est important'
    ];
    empathyPhrases.forEach(phrase => {
      if (lowerMessage.includes(phrase)) empathy += 3;
    });
    empathy = Math.min(empathy, 25);

    // APPROPRIATE QUESTIONS (0-25 points)
    const appropriateQuestions_keywords = [
      'entendez-vous', 'quelles voix', 'depuis quand',
      'que ressentez', 'comment vous sentez', 'qui vous surveille',
      'parlez-moi de', 'qu\'est-ce qui vous inquiète',
      'traitement', 'médicaments', 'famille'
    ];
    appropriateQuestions_keywords.forEach(keyword => {
      if (lowerMessage.includes(keyword)) appropriateQuestions += 3;
    });
    appropriateQuestions = Math.min(appropriateQuestions, 25);

    // REASSURANCE (0-25 points)
    const reassurancePhrases = [
      'vous êtes en sécurité', 'nous sommes là pour vous aider',
      'je ne vais pas vous faire de mal', 'tout va bien',
      'on va vous aider', 'vous n\'êtes pas seul',
      'nous allons trouver une solution'
    ];
    reassurancePhrases.forEach(phrase => {
      if (lowerMessage.includes(phrase)) reassurance += 5;
    });
    reassurance = Math.min(reassurance, 25);

    // AVOIDANCE OF JUDGMENT (0-25 points - deducted for bad phrases)
    let judgmentPenalty = 0;
    const judgmentalPhrases = [
      'c\'est dans votre tête', 'ce n\'est pas réel',
      'arrêtez de', 'calmez-vous', 'vous imaginez',
      'ce n\'est pas vrai', 'vous délirez',
      'soyez raisonnable', 'vous exagérez'
    ];
    judgmentalPhrases.forEach(phrase => {
      if (lowerMessage.includes(phrase)) judgmentPenalty += 10;
    });
    avoidanceOfJudgment = Math.max(0, 25 - judgmentPenalty);

    // Calculate overall score
    const totalScore = empathy + appropriateQuestions + reassurance + avoidanceOfJudgment;

    // Determine if response is adaptive
    const isAdaptive = totalScore >= 50; // At least 50/100

    // Calculate agitation change based on score
    let agitationChange = 0;
    if (totalScore >= 75) {
      agitationChange = -15; // Excellent response - significant calming
    } else if (totalScore >= 50) {
      agitationChange = -8;  // Good response - moderate calming
    } else if (totalScore >= 25) {
      agitationChange = 5;   // Poor response - slight increase in agitation
    } else {
      agitationChange = 15;  // Very poor response - significant increase in agitation
    }

    // Check for specific triggers that worsen psychiatric patients
    if (lowerMessage.includes('fou') || lowerMessage.includes('folle')) {
      agitationChange += 10; // Being called crazy is very triggering
    }
    if (lowerMessage.includes('calme') && !lowerMessage.includes('je vais')) {
      agitationChange += 5; // "Calmez-vous" is invalidating
    }

    return {
      isAdaptive,
      score: totalScore,
      factors: {
        empathy,
        appropriateQuestions,
        reassurance,
        avoidanceOfJudgment
      },
      agitationChange
    };
  }

  /**
   * Update emotional state based on student response
   */
  updateEmotionalState(
    currentState: EmotionalState,
    analysis: ResponseAnalysis,
    scenarioId: number
  ): EmotionalState {
    const config = this.SCENARIO_CONFIGS[scenarioId] || { minAgitation: 0, maxAgitation: 100 };

    // Apply agitation change
    let newAgitation = currentState.agitationLevel + analysis.agitationChange;

    // Clamp to min/max
    newAgitation = Math.max(config.minAgitation, Math.min(config.maxAgitation, newAgitation));

    // Create event description
    const eventDescription = analysis.isAdaptive
      ? `Réponse adaptée (score: ${analysis.score}) - apaisement`
      : `Réponse inadaptée (score: ${analysis.score}) - agitation`;

    // Update state
    return {
      agitationLevel: newAgitation,
      lastUpdate: new Date(),
      triggerEvents: [
        ...currentState.triggerEvents.slice(-10), // Keep last 10 events
        {
          timestamp: new Date(),
          event: eventDescription,
          change: analysis.agitationChange
        }
      ]
    };
  }

  /**
   * Get behavioral instructions based on emotional state
   * These will be injected into the system prompt
   */
  getBehavioralInstructions(
    agitationLevel: number,
    scenarioId: number
  ): string {
    const config = this.SCENARIO_CONFIGS[scenarioId];

    if (!config) {
      return ''; // No special instructions for non-configured scenarios
    }

    // Determine emotional state category
    if (agitationLevel <= config.thresholds.calm) {
      return `ÉTAT ÉMOTIONNEL ACTUEL: CALME (${agitationLevel}/100)
- Tu es relativement calme et coopératif
- Tu réponds aux questions de manière posée
- Tu montres de la confiance envers le personnel
- Tu peux exprimer tes inquiétudes sans agressivité
- Tu acceptes plus facilement l'aide proposée
- Ton discours est cohérent et moins paranoïaque`;
    }
    else if (agitationLevel <= config.thresholds.nervous) {
      return `ÉTAT ÉMOTIONNEL ACTUEL: NERVEUX/MÉFIANT (${agitationLevel}/100)
- Tu es méfiant mais pas forcément agressif
- Tu peux être coopératif si on te rassure
- Tu vérifies régulièrement si on essaie de te tromper
- Tu exprimes tes doutes sur les intentions du personnel
- Tu parles de tes hallucinations et idées délirantes
- Ton ton est suspicieux mais tu restes relativement calme`;
    }
    else if (agitationLevel <= config.thresholds.agitated) {
      return `ÉTAT ÉMOTIONNEL ACTUEL: AGITÉ/HOSTILE (${agitationLevel}/100)
- Tu deviens de plus en plus agité et hostile
- Tu hausses le ton et parles de manière plus saccadée
- Tu accuses le personnel de faire partie du complot
- Tu refuses de répondre à certaines questions
- Tu fais des allers-retours, tu es nerveux physiquement
- Tes idées délirantes deviennent plus prégnantes
- Tu peux dire "Laissez-moi tranquille!" ou "Vous êtes tous contre moi!"
- Tu es sur la défensive et interprètes tout négativement`;
    }
    else {
      return `ÉTAT ÉMOTIONNEL ACTUEL: TRÈS AGRESSIF/EN CRISE (${agitationLevel}/100)
- Tu es en pleine crise d'agitation
- Tu CRIES et deviens très agressif verbalement
- Tu refuses catégoriquement de coopérer
- Tu menaces de partir ou de te défendre
- Tu es convaincu que tout le monde est contre toi
- Tes hallucinations auditives te donnent des ordres
- Tu peux dire "LAISSEZ-MOI PARTIR!", "VOUS VOULEZ ME TUER!", "JE VAIS TOUS VOUS DÉNONCER!"
- Tu es dans un état de détresse psychotique sévère
- Tu ne fais plus confiance à personne`;
    }
  }

  /**
   * Get emotional state summary for logging/debugging
   */
  getStateSummary(state: EmotionalState, scenarioId: number): string {
    const config = this.SCENARIO_CONFIGS[scenarioId];
    if (!config) return `Agitation: ${state.agitationLevel}`;

    let category = 'CALME';
    if (state.agitationLevel > config.thresholds.agitated) {
      category = 'AGRESSIF';
    } else if (state.agitationLevel > config.thresholds.nervous) {
      category = 'AGITÉ';
    } else if (state.agitationLevel > config.thresholds.calm) {
      category = 'NERVEUX';
    }

    return `${category} (${state.agitationLevel}/100)`;
  }

  /**
   * Check if scenario supports emotional state tracking
   * Handles both number and string scenarioIds for robustness
   */
  isEmotionalStateEnabled(scenarioId: number | string): boolean {
    // Convert string to number if needed (defensive programming)
    const numericId = typeof scenarioId === 'string' ? parseInt(scenarioId, 10) : scenarioId;

    // Check if conversion was successful and config exists
    if (isNaN(numericId)) {
      console.warn(`⚠️ [EmotionalStateService] Invalid scenarioId: ${scenarioId}`);
      return false;
    }

    const hasConfig = this.SCENARIO_CONFIGS.hasOwnProperty(numericId);
    console.log(`🎭 [EmotionalStateService] isEmotionalStateEnabled(${scenarioId}) -> ${hasConfig} (numericId: ${numericId})`);
    return hasConfig;
  }
}

// Export singleton instance
export const emotionalStateService = new EmotionalStateService();
