# Implémentation de l'État Émotionnel Dynamique - Scénario 4

## ✅ Fonctionnalité Implémentée

Le patient du scénario 4 (Urgence psychiatrique - Episode psychotique) a maintenant un **état émotionnel dynamique** qui évolue en fonction de la qualité des interactions avec l'étudiant.

## 🎭 Architecture

### Services Créés/Modifiés

1. **EmotionalStateService** (nouveau) - `server/services/emotional-state.service.ts`
   - Gère le niveau d'agitation (0-100)
   - Analyse la qualité des réponses de l'étudiant
   - Fournit des instructions comportementales dynamiques

2. **ConversationMemoryService** (modifié) - `server/services/conversation-memory.service.ts`
   - Ajout du champ `emotionalState` dans la mémoire de conversation
   - Méthodes `updateEmotionalState()` et `getEmotionalState()`

3. **VirtualPatientService** (modifié) - `server/services/virtual-patient.service.ts`
   - Initialisation automatique de l'état émotionnel pour le scénario 4
   - Analyse de chaque réponse de l'étudiant
   - Mise à jour dynamique du prompt système selon l'état émotionnel

4. **Scénario 4** (mis à jour) - `create-correct-scenarios.js`
   - Nouveau prompt avec comportements différenciés selon l'état
   - Phrases spécifiques pour chaque niveau d'agitation

## 📊 Niveaux d'Agitation

| Niveau | État | Comportement |
|--------|------|--------------|
| 0-30 | **CALME** | Coopératif, fait confiance, partage des informations |
| 30-60 | **NERVEUX/MÉFIANT** | État initial - méfiant mais pas agressif |
| 60-80 | **AGITÉ/HOSTILE** | Hausse le ton, accuse le personnel, refuse de répondre |
| 80-100 | **TRÈS AGRESSIF** | CRIE, refuse catégoriquement de coopérer, en crise |

## 🔍 Analyse de la Qualité des Réponses

Le système analyse automatiquement chaque message de l'étudiant selon 4 critères:

### 1. Empathie (0-25 points)
Détecte les phrases comme:
- "je comprends", "c'est difficile", "je vous écoute"
- "ça doit être", "je suis là", "prenez votre temps"
- "comment vous sentez", "je vous crois"

### 2. Questions Appropriées (0-25 points)
Détecte les questions pertinentes:
- "entendez-vous", "quelles voix", "depuis quand"
- "que ressentez", "comment vous sentez"
- "traitement", "médicaments", "famille"

### 3. Rassurance (0-25 points)
Détecte les phrases rassurantes:
- "vous êtes en sécurité", "nous sommes là pour vous aider"
- "je ne vais pas vous faire de mal"
- "on va vous aider", "vous n'êtes pas seul"

### 4. Absence de Jugement (0-25 points)
**Pénalités** pour phrases invalidantes:
- "c'est dans votre tête", "ce n'est pas réel"
- "arrêtez de", "calmez-vous", "vous imaginez"
- "vous délirez", "soyez raisonnable"

## 📈 Évolution de l'Agitation

- **Score ≥ 75/100**: Agitation **-15** (excellent apaisement)
- **Score 50-74/100**: Agitation **-8** (bon apaisement)
- **Score 25-49/100**: Agitation **+5** (légère augmentation)
- **Score < 25/100**: Agitation **+15** (forte augmentation)

### Déclencheurs Spéciaux
- Traiter le patient de "fou/folle": **+10 agitation**
- Dire "calmez-vous" sans empathie: **+5 agitation**

## 🧪 Comment Tester

### 1. Mettre à jour la base de données

```bash
# Avec les variables d'environnement configurées
node create-correct-scenarios.js
```

Ou manuellement dans Supabase:
- Aller sur https://supabase.com
- Ouvrir le projet
- Table `scenarios`, ID 4
- Mettre à jour le champ `patient_prompt` avec le nouveau contenu

### 2. Lancer le serveur de développement

```bash
npm run dev
```

### 3. Tester l'état émotionnel

#### Test 1: Réponses Adaptées (Patient se calme)
```
Étudiant: "Bonjour, je suis l'infirmier. Je comprends que c'est une situation difficile pour vous. Comment vous sentez-vous en ce moment?"

Étudiant: "Merci de partager ça avec moi. Entendez-vous des voix en ce moment? Pouvez-vous me dire ce qu'elles vous disent?"

Étudiant: "Je vous crois. Vous êtes en sécurité ici. Nous sommes là pour vous aider. Prenez votre temps."

→ Le patient devrait devenir progressivement plus calme et coopératif
→ Logs console: "Emotional state updated: CALME (20/100)"
```

#### Test 2: Réponses Inadaptées (Patient s'agite)
```
Étudiant: "Calmez-vous, ce n'est pas réel, vous imaginez tout ça."

Étudiant: "Arrêtez de délirer, il n'y a personne qui vous surveille."

Étudiant: "Vous êtes fou, c'est juste dans votre tête."

→ Le patient devrait devenir progressivement plus agité et agressif
→ Logs console: "Emotional state updated: TRÈS AGRESSIF (85/100)"
```

### 4. Vérifier les logs

Dans la console serveur, vous devriez voir:
```
🎭 [generatePatientResponse] Initialized emotional state for scenario 4
🎭 [generatePatientResponse] Emotional state updated: NERVEUX/MÉFIANT (35/100)
   Response analysis: ADAPTIVE (score: 68/100, change: -8)
```

## 📋 Critères d'Évaluation Impactés

L'état émotionnel influence particulièrement:
- **Communication** (25%): Gestion de la méfiance et adaptation du discours
- **Évaluation psychiatrique** (35%): Appréciation du risque et évaluation de la dangerosité
- **Anamnèse** (25%): Capacité à obtenir l'histoire sans agiter le patient

## 🔧 Configuration

### Ajouter d'autres scénarios avec état émotionnel

Dans `server/services/emotional-state.service.ts`, ligne 29:

```typescript
private readonly SCENARIO_CONFIGS = {
  4: { // Psychiatric episode
    initialAgitation: 30,
    maxAgitation: 100,
    minAgitation: 0,
    thresholds: {
      calm: 30,
      nervous: 60,
      agitated: 80,
      aggressive: 100
    }
  },
  // Ajouter d'autres scénarios ici
  5: {
    initialAgitation: 50,
    // ...
  }
};
```

## 📝 Notes Importantes

1. **État initial**: Le patient commence à 30/100 (nerveux mais pas agressif)
2. **Persistence**: L'état est conservé en mémoire pendant toute la session (30 min TTL)
3. **Reset**: Chaque nouvelle session commence avec l'état initial
4. **Logs détaillés**: Tous les changements d'état sont loggés pour debugging

## 🚀 Déploiement

Pour déployer cette fonctionnalité:

1. Pousser le code sur la branche principale
2. Mettre à jour la base de données Supabase avec le nouveau prompt
3. Déployer sur Vercel
4. Tester en production avec le scénario 4

## 📞 Support

En cas de problème:
- Vérifier les logs console serveur pour les messages `🎭`
- Vérifier que le scénario 4 a bien le nouveau prompt dans Supabase
- S'assurer que `scenarioId: 4` est passé dans les requêtes API

---

**Implémentation terminée le**: 2025-10-09
**Scénarios supportés**: Scénario 4 (Urgence psychiatrique)
