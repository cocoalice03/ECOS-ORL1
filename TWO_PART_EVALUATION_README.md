# Structure d'évaluation en 2 parties - ECOS ORL

## Vue d'ensemble

Ce document décrit la nouvelle structure d'évaluation en 2 parties spécifiquement conçue pour le scénario ORL pédiatrique (Otite Moyenne Aiguë).

### Principe

L'évaluation se divise en deux parties distinctes :
- **Partie 1** : Aptitude clinique (10 points) - Notation binaire
- **Partie 2** : Communications et attitudes (10 points) - Notation qualitative (0-4)
- **Score final** : /20 (convertible en pourcentage)

---

## Partie 1 : Aptitude clinique (10 points)

### Type de notation

**Binaire stricte** : Chaque item est soit présent (points attribués), soit absent (0 point).

Pas de nuance, pas de points partiels.

### Items évalués (10 au total)

| # | Item | Points | Critères de validation |
|---|------|--------|------------------------|
| 1 | Description iconographique du tympan | 1 | Au moins 2 termes descriptifs |
| 2 | Diagnostic OMA purulente collectée | 1 | Mot "collectée" ou "purulente" présent |
| 3 | Question sur l'état général | 0.5 | Question posée |
| 4 | Diminution de l'alimentation | 1 | Question posée sur l'alimentation |
| 5 | Mesure de la température | 1 | Mention de prise/vérification température |
| 6 | Indication d'antibiothérapie | 1 | Antibiothérapie indiquée |
| 7 | Prescription amoxicilline | 0.5 | Molécule + 2 éléments de posologie |
| 8 | Expliquer les prises à la mère | 1 | Explication donnée |
| 9 | Antalgiques, antipyrétiques | 1 | Prescrits |
| 10 | Consignes de reconsultation | 2 | Consignes données |

**Total** : 10 points

### Détection

Le modèle utilise la **compréhension sémantique** pour détecter la présence des items (pas seulement des mots-clés stricts). Les synonymes et formulations équivalentes sont acceptés.

---

## Partie 2 : Communications et attitudes (10 points)

### Type de notation

**Qualitative** : Échelle de 0 à 4 pour chaque critère.

### Échelle de notation

- **0** : Insuffisante
- **1** : Limite
- **2** : Satisfaisante
- **3** : Très satisfaisante
- **4** : Remarquable

### Critères évalués (5 au total)

| # | Critère | Score max | Poids | Description |
|---|---------|-----------|-------|-------------|
| 1 | Aptitude à écouter | 4 | 2 | Écoute active, reformulation, empathie |
| 2 | Aptitude à questionner | 4 | 2 | Pertinence et clarté des questions |
| 3 | Aptitude à structurer/mener l'entrevue | 4 | 2 | Organisation logique, transitions |
| 4 | Aptitude à fournir les renseignements | 4 | 2 | Clarté et complétude des informations |
| 5 | Aptitude à proposer une prise en charge | 4 | 2 | Qualité de la proposition thérapeutique |

**Total** : 10 points (4 points max × 5 critères × poids / 10)

### Évaluation détaillée

Pour chaque critère, le modèle doit :
1. **Identifier** les phrases clés dans les échanges
2. **Attribuer** un niveau de performance (0-4)
3. **Citer** des extraits pertinents de la conversation
4. **Justifier** avec des critiques positives et axes d'amélioration

---

## Structure JSON en base de données

```json
{
  "type": "two_part_structure",
  "partie_1": {
    "nom": "Aptitude clinique",
    "max_points": 10,
    "type_notation": "binaire",
    "items": [
      {
        "id": "description_tympan",
        "description": "Description iconographique du tympan",
        "points": 1,
        "criteres_validation": "Au moins 2 termes descriptifs",
        "mots_cles_suggeres": ["tympan", "rouge", "bombé"]
      }
      // ... autres items
    ]
  },
  "partie_2": {
    "nom": "Communications et attitudes",
    "max_points": 10,
    "type_notation": "qualitative",
    "criteres": [
      {
        "id": "ecouter",
        "nom": "Aptitude à écouter",
        "max_score": 4,
        "poids": 2,
        "description": "Capacité à écouter activement...",
        "niveaux": {
          "0": "Insuffisante - ...",
          "1": "Limite - ...",
          "2": "Satisfaisante - ...",
          "3": "Très satisfaisante - ...",
          "4": "Remarquable - ..."
        }
      }
      // ... autres critères
    ]
  }
}
```

---

## Format de sortie de l'évaluation

Le modèle LLM (GPT-4o) retourne un JSON avec cette structure :

```json
{
  "partie_1": {
    "items": [
      {
        "id": "description_tympan",
        "description": "Description iconographique du tympan",
        "present": true,
        "points_attribues": 1,
        "points_obtenus": 1,
        "justification": "L'étudiant a décrit le tympan comme...",
        "extraits": ["Le tympan est rouge et bombé"],
        "elements_identifies": ["rouge", "bombé"]
      }
      // ... autres items
    ],
    "score_total": 8.5
  },
  "partie_2": {
    "criteres": [
      {
        "id": "ecouter",
        "nom": "Aptitude à écouter",
        "score": 3,
        "niveau": "Très satisfaisante",
        "points_obtenus": 0.6,
        "phrases_cles": ["Je comprends votre inquiétude"],
        "extraits_pertinents": ["L'étudiant a dit..."],
        "critiques_positives": ["Bonne reformulation"],
        "axes_amelioration": ["Pourrait montrer plus d'empathie"],
        "justification": "L'étudiant démontre..."
      }
      // ... autres critères
    ],
    "score_total": 7.5
  },
  "score_final_sur_20": 16,
  "score_final_percent": 80,
  "synthese": "Performance globale satisfaisante...",
  "forces_majeures": ["Diagnostic correct", "Bonne prescription"],
  "faiblesses_prioritaires": ["Manque d'explications à la mère"],
  "recommandations": ["Pratiquer la communication", "..."]
}
```

---

## Installation et utilisation

### 1. Mettre à jour le scénario ORL dans Supabase

Exécutez le script SQL fourni :

```bash
# Via Supabase Dashboard > SQL Editor
# Copiez-collez le contenu de: migrations/update-orl-scenario-two-part.sql
```

Ou via CLI Supabase :

```bash
supabase db execute -f migrations/update-orl-scenario-two-part.sql
```

### 2. Vérification

Le scénario ORL doit maintenant avoir `evaluation_criteria.type === "two_part_structure"`.

```sql
SELECT
  id,
  title,
  evaluation_criteria->>'type' as criteria_type
FROM scenarios
WHERE evaluation_criteria->>'type' = 'two_part_structure';
```

### 3. Test de la nouvelle structure

1. **Lancez une session ORL** depuis l'interface étudiant
2. **Dialoguez** avec le patient virtuel (simulation OMA)
3. **Terminez la session**
4. **Demandez l'évaluation**

Le rapport devrait maintenant afficher :
- ✅ Score global : X/20 (Y%)
- ✅ Partie 1 : Aptitude clinique (items binaires)
- ✅ Partie 2 : Communications et attitudes (critères qualitatifs)

---

## Compatibilité

### Scénarios existants

La logique d'évaluation actuelle (legacy) est **conservée** pour tous les autres scénarios.

Le système détecte automatiquement le type de structure :
- Si `criteria.type === "two_part_structure"` → Nouvelle logique
- Sinon → Logique legacy (actuelle)

### Backend

Fichier modifié : `server/routes.ts` (lignes ~1764-1966)

Fonction de détection :
```typescript
const detectCriteriaStructure = (criteria: any): 'two_part' | 'legacy'
```

### Frontend

Fichier modifié : `client/src/components/ecos/EvaluationReport.tsx` (lignes 280-525)

Détection :
```typescript
const isTwoPartStructure = (transformedEvaluation as any)?.type === 'two_part';
```

---

## Calcul des scores

### Partie 1 (Aptitude clinique)

```
Score Partie 1 = Σ(points_obtenus pour chaque item)
```

**Exemple** :
- 9 items validés sur 10 → 8.5/10 points

### Partie 2 (Communications et attitudes)

```
Points critère = (score / max_score) × (poids / 10)
Score Partie 2 = Σ(points pour chaque critère)
```

**Exemple** :
- Écouter : 3/4 × 2 = 1.5 pts
- Questionner : 2/4 × 2 = 1 pt
- Structurer : 4/4 × 2 = 2 pts
- Informer : 3/4 × 2 = 1.5 pts
- Proposer PEC : 2/4 × 2 = 1 pt
- **Total** : 7/10 pts

### Score final

```
Score final = Partie 1 + Partie 2
Score en % = (Score final / 20) × 100
```

**Exemple** :
- Partie 1 : 8.5/10
- Partie 2 : 7/10
- **Total** : 15.5/20 (77.5%)

---

## Logs et debugging

### Backend

Recherchez ces logs dans la console serveur :

```
🔍 [STRUCTURE] Detected two-part structure for ORL scenario
📊 [TWO-PART] Starting two-part evaluation for ORL scenario
⏱️ [TWO-PART-PERF] OpenAI completed in XXXms
✅ [TWO-PART] JSON parsed successfully
✅ [TWO-PART] Stored evaluation for session XXX in database
```

### Frontend

Console du navigateur :

```javascript
🔍 Raw evaluation data: { type: 'two_part', partie_1: {...}, ... }
🔍 Transformed evaluation: { ... }
```

---

## Troubleshooting

### Problème : L'ancienne structure s'affiche toujours

**Causes possibles** :
1. Le scénario n'a pas été mis à jour dans la DB
2. Le cache du navigateur contient l'ancienne structure

**Solutions** :
```sql
-- Vérifier la structure du scénario
SELECT evaluation_criteria FROM scenarios WHERE id = 1;

-- Forcer le rechargement sans cache
Ctrl + Shift + R (ou Cmd + Shift + R sur Mac)
```

### Problème : Erreur LLM "TWO_PART_EVALUATION_FAILED"

**Causes possibles** :
1. Timeout OpenAI (prompt trop long)
2. JSON mal formé retourné par le LLM
3. Clé API OpenAI invalide

**Solutions** :
- Vérifier les logs backend pour le message d'erreur détaillé
- Réduire la longueur de la conversation (max 30 messages)
- Vérifier `OPENAI_API_KEY` dans `.env`

---

## Fichiers modifiés

| Fichier | Description |
|---------|-------------|
| `server/routes.ts` | Logique d'évaluation backend |
| `client/src/components/ecos/EvaluationReport.tsx` | Affichage frontend |
| `migrations/update-orl-scenario-two-part.sql` | Script de migration DB |
| `TWO_PART_EVALUATION_README.md` | Cette documentation |

---

## Auteur

Implémentation : Claude Code + David Cherubini
Date : 2025-01-28
Version : 1.0
