-- Migration: Update ORL scenario with two-part evaluation structure
-- Date: 2025-01-28
-- Description: Updates the ORL pediatric scenario (OMA) with the new two-part evaluation criteria

UPDATE scenarios
SET
  evaluation_criteria = '{
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
          "criteres_validation": "Au moins 2 termes descriptifs du tympan",
          "mots_cles_suggeres": ["tympan", "rouge", "bombé", "mat", "opaque", "inflammé", "épanchement"]
        },
        {
          "id": "diagnostic_oma",
          "description": "Diagnostic OMA purulente collectée",
          "points": 1,
          "criteres_validation": "Mot collectée ou purulente présent, ou diagnostic équivalent",
          "mots_cles_suggeres": ["collectée", "purulente", "OMA", "otite moyenne aiguë"]
        },
        {
          "id": "question_etat_general",
          "description": "Question sur létat général",
          "points": 0.5,
          "criteres_validation": "Question posée sur létat général de lenfant"
        },
        {
          "id": "alimentation",
          "description": "Diminution de lalimentation",
          "points": 1,
          "criteres_validation": "Question posée sur lalimentation ou lappétit"
        },
        {
          "id": "temperature",
          "description": "Mesure de la température",
          "points": 1,
          "criteres_validation": "Mention de prise ou vérification de température"
        },
        {
          "id": "indication_antibio",
          "description": "Indication dantibiothérapie",
          "points": 1,
          "criteres_validation": "Antibiothérapie indiquée ou prescrite"
        },
        {
          "id": "prescription_amoxicilline",
          "description": "Prescription amoxicilline",
          "points": 0.5,
          "criteres_validation": "Molécule amoxicilline + 2 éléments de posologie parmi: dose, fréquence, durée",
          "mots_cles_suggeres": ["amoxicilline", "mg", "kg", "jour", "matin", "soir", "fois par jour"]
        },
        {
          "id": "explication_prises",
          "description": "Expliquer les prises à la mère",
          "points": 1,
          "criteres_validation": "Explication donnée sur comment administrer le traitement"
        },
        {
          "id": "antalgiques_antipyretiques",
          "description": "Antalgiques, antipyrétiques",
          "points": 1,
          "criteres_validation": "Prescription dantalgiques et/ou antipyrétiques",
          "mots_cles_suggeres": ["paracétamol", "ibuprofène", "douleur", "fièvre", "doliprane"]
        },
        {
          "id": "consignes_reconsultation",
          "description": "Consignes de reconsultation",
          "points": 2,
          "criteres_validation": "Consignes données sur quand reconsulter (aggravation, persistance fièvre, etc.)"
        }
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
          "description": "Capacité à écouter activement la mère, reformuler, montrer de lempathie",
          "niveaux": {
            "0": "Insuffisante - Nécoute pas, coupe la parole",
            "1": "Limite - Écoute minimale, peu dattention",
            "2": "Satisfaisante - Écoute correcte, quelques reformulations",
            "3": "Très satisfaisante - Bonne écoute, reformulations régulières",
            "4": "Remarquable - Écoute exceptionnelle, empathie marquée"
          }
        },
        {
          "id": "questionner",
          "nom": "Aptitude à questionner",
          "max_score": 4,
          "poids": 2,
          "description": "Qualité des questions posées (pertinence, clarté, logique)",
          "niveaux": {
            "0": "Insuffisante - Aucune question pertinente",
            "1": "Limite - Questions vagues ou peu pertinentes",
            "2": "Satisfaisante - Questions appropriées mais basiques",
            "3": "Très satisfaisante - Questions ciblées et pertinentes",
            "4": "Remarquable - Questionnement méthodique et approfondi"
          }
        },
        {
          "id": "structurer",
          "nom": "Aptitude à structurer/mener lentrevue",
          "max_score": 4,
          "poids": 2,
          "description": "Organisation logique de la consultation, transitions fluides",
          "niveaux": {
            "0": "Insuffisante - Désorganisé, sans structure",
            "1": "Limite - Structure confuse",
            "2": "Satisfaisante - Structure présente mais perfectible",
            "3": "Très satisfaisante - Bonne structure, transitions claires",
            "4": "Remarquable - Structure exemplaire, très professionnel"
          }
        },
        {
          "id": "informer",
          "nom": "Aptitude à fournir les renseignements",
          "max_score": 4,
          "poids": 2,
          "description": "Clarté et complétude des informations données à la mère",
          "niveaux": {
            "0": "Insuffisante - Informations absentes ou erronées",
            "1": "Limite - Informations incomplètes ou confuses",
            "2": "Satisfaisante - Informations correctes mais partielles",
            "3": "Très satisfaisante - Informations claires et complètes",
            "4": "Remarquable - Informations exceptionnellement claires et pédagogiques"
          }
        },
        {
          "id": "proposer_pec",
          "nom": "Aptitude à proposer une prise en charge",
          "max_score": 4,
          "poids": 2,
          "description": "Qualité de la proposition thérapeutique et du suivi",
          "niveaux": {
            "0": "Insuffisante - Aucune prise en charge proposée",
            "1": "Limite - Prise en charge inadéquate",
            "2": "Satisfaisante - Prise en charge appropriée basique",
            "3": "Très satisfaisante - Prise en charge complète et justifiée",
            "4": "Remarquable - Prise en charge exemplaire avec suivi détaillé"
          }
        }
      ]
    }
  }'::jsonb,
  updated_at = NOW()
WHERE
  -- Update the scenario that matches ORL pediatric consultation
  -- Adjust the WHERE clause based on your actual scenario identification
  title ILIKE '%ORL%'
  OR title ILIKE '%otite%'
  OR title ILIKE '%OMA%'
  OR id = 1  -- Adjust to your actual ORL scenario ID
RETURNING id, title, evaluation_criteria;

-- Verify the update
SELECT
  id,
  title,
  evaluation_criteria->>'type' as criteria_type,
  jsonb_pretty(evaluation_criteria) as formatted_criteria
FROM scenarios
WHERE evaluation_criteria->>'type' = 'two_part_structure';
