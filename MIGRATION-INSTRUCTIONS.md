# Instructions de Migration Supabase - Correction du Stockage des Évaluations

**Date:** 29 septembre 2025
**Priorité:** CRITIQUE
**Durée estimée:** 5 minutes

---

## ⚠️ Problème Actuel

Les évaluations ECOS semblent réussir (HTTP 200) mais ne sont pas persistées dans Supabase. L'endpoint `/report` retourne 404 "Aucune évaluation enregistrée".

**Cause:** Colonnes manquantes dans la table `evaluations` de Supabase.

---

## 🎯 Solution : Appliquer la Migration SQL

### Étape 1: Ouvrir l'Éditeur SQL Supabase

**Lien direct:**
https://bgrxjdcpxgdunanwtpvv.supabase.co/project/_/sql

Ou via le dashboard:
1. Aller sur https://supabase.com/dashboard
2. Sélectionner le projet `bgrxjdcpxgdunanwtpvv`
3. Cliquer sur "SQL Editor" dans le menu latéral

---

### Étape 2: Copier et Exécuter le SQL

Copier exactement ce SQL dans l'éditeur:

```sql
-- Migration: Add missing evaluation columns
-- Date: 2025-09-29
-- Purpose: Fix evaluation storage by adding columns required by code

-- Add missing columns to evaluations table
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS heuristic JSONB,
  ADD COLUMN IF NOT EXISTS llm_score_percent INTEGER,
  ADD COLUMN IF NOT EXISTS criteria_details JSONB,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_evaluations_session_id ON public.evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_student_email ON public.evaluations(student_email);
CREATE INDEX IF NOT EXISTS idx_evaluations_scenario_id ON public.evaluations(scenario_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON public.evaluations(created_at);

-- Add column documentation
COMMENT ON COLUMN public.evaluations.heuristic IS 'Heuristic evaluation data (fallback scoring)';
COMMENT ON COLUMN public.evaluations.llm_score_percent IS 'LLM-generated score percentage';
COMMENT ON COLUMN public.evaluations.criteria_details IS 'Detailed evaluation criteria and scores';
COMMENT ON COLUMN public.evaluations.summary IS 'Summary of the evaluation';
COMMENT ON COLUMN public.evaluations.created_at IS 'Timestamp when evaluation was created';
COMMENT ON COLUMN public.evaluations.updated_at IS 'Timestamp when evaluation was last updated';
```

**Bouton:** Cliquer sur "Run" (Cmd/Ctrl + Enter)

---

### Étape 3: Vérifier que la Migration a Réussi

Exécuter cette requête de vérification:

```sql
-- Verify new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'evaluations'
  AND column_name IN ('heuristic', 'llm_score_percent', 'criteria_details', 'summary', 'created_at', 'updated_at')
ORDER BY column_name;
```

**Résultat attendu:** 6 lignes avec les nouvelles colonnes

---

### Étape 4: Tester le Système

1. **Créer une nouvelle session ECOS:**
   - Aller sur http://localhost:5003/student/cherubindavid@gmail.com?scenario=4
   - Compléter une conversation (au moins 2 échanges)
   - Cliquer sur "Terminer l'examen"

2. **Vérifier les logs serveur:**
   - Chercher: `🔍 [DEBUG] Insert payload columns:`
   - Chercher: `🔍 [DEBUG] Supabase response - data: EXISTS`
   - Chercher: `✅ Created evaluation for session ... - DB record ID:`

3. **Vérifier dans Supabase:**
   ```sql
   SELECT id, session_id, global_score, created_at, heuristic IS NOT NULL as has_heuristic
   FROM public.evaluations
   ORDER BY created_at DESC
   LIMIT 5;
   ```

4. **Tester l'endpoint report:**
   - L'interface devrait afficher le rapport d'évaluation
   - Plus de 404 "Aucune évaluation enregistrée"

---

## 🔍 Diagnostic des Logs

Après avoir appliqué la migration, les logs devraient montrer:

### ✅ Succès Attendu:
```
📤 Attempting to store evaluation for session session_4_xxx
🔍 [DEBUG] Insert payload columns: ['session_id', 'scenario_id', 'student_email', 'scores', 'global_score', ...]
🔍 [DEBUG] Session DB ID: 58 String ID: session_4_xxx
🔍 [DEBUG] Supabase response - data: EXISTS error: NONE
✅ Created evaluation for session session_4_xxx - DB record ID: 26
✅ Stored evaluation for session session_4_xxx in database
```

### ❌ Échec (Colonnes Toujours Manquantes):
```
📤 Attempting to store evaluation for session session_4_xxx
🔍 [DEBUG] Insert payload columns: [...]
🔍 [DEBUG] Session DB ID: 58 String ID: session_4_xxx
🔍 [DEBUG] Supabase response - data: NULL error: NONE
❌ Supabase returned null data despite no error - possible schema mismatch
❌ Failed to store evaluation in database
```

Si vous voyez l'échec, cela signifie que la migration n'a pas été appliquée correctement.

---

## 🆘 Dépannage

### Problème: "column does not exist" error

**Solution:** La colonne existe déjà mais avec un nom différent. Vérifier le schéma:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'evaluations';
```

### Problème: Permission denied

**Solution:** Utiliser le Service Role Key dans les paramètres de connexion

### Problème: Table 'evaluations' does not exist

**Solution:** La table s'appelle peut-être différemment. Lister toutes les tables:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

---

## 📊 Résultat Final Attendu

Une fois la migration appliquée et testée:

- ✅ Évaluations persistées dans Supabase
- ✅ Endpoint `/report` retourne les données (plus de 404)
- ✅ Logs montrent `data: EXISTS`
- ✅ Interface affiche les rapports d'évaluation correctement
- ✅ Données survivent aux redémarrages du serveur

---

**Note:** Cette migration est **idempotente** (peut être exécutée plusieurs fois sans problème grâce à `IF NOT EXISTS`).