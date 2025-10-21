import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EvaluationReportProps {
  sessionId: string;
  email: string;
}

interface Criterion {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
  evidence?: CriterionEvidence[];
  strengths?: string[];
  weaknesses?: string[];
  actions?: string[];
  justification?: string;
  weight?: number;
  rawScore?: number;
  indicators?: string[];
  description?: string;
}

interface CriterionEvidence {
  indicator: string;
  role: string;
  rawRole?: string;
  excerpt: string;
  timestamp?: string | null;
}

interface EvaluationPayload {
  overall_score?: number;
  criteria?: Criterion[];
  scores?: Record<string, number>;
  comments?: Record<string, string>;
  heuristic?: {
    overallPercent?: number;
    criteria?: Array<{
      id: string;
      heuristicScore?: number;
      coverageRatio?: number;
      missingIndicators?: string[];
      evidence?: CriterionEvidence[];
    }>;
  };
  llmScorePercent?: number;
}

interface EvaluationData {
  sessionId: string;
  overallScore?: number;
  criteria?: Criterion[];
  scores?: Record<string, number>;
  comments?: Record<string, string>;
  evaluation?: EvaluationPayload;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
}

export default function EvaluationReport({ sessionId, email }: EvaluationReportProps) {
  // Fetch evaluation data
  const { data: evaluation, isLoading, error } = useQuery({
    queryKey: ['ecos-evaluation', sessionId],
    queryFn: async () => {
      const response = await apiRequest('POST', `/api/ecos/sessions/${sessionId}/evaluate?email=${email}`, {
        responses: [] // Empty for now - should be populated from actual session
      });
      return response as EvaluationData;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes to avoid redundant evaluations
    retry: false // Don't retry failed evaluations
  });

  // Transform evaluation data to match expected structure
  const transformedEvaluation = evaluation ? (() => {
    const evalData = (evaluation as any).evaluation || evaluation;
    const heuristicCriteria = Array.isArray(evalData?.heuristic?.criteria)
      ? evalData.heuristic.criteria
      : [];
    const heuristicMap = new Map(
      heuristicCriteria.map((criterion: any) => [criterion.id, criterion])
    );

    const normalizedCriteria: Criterion[] = Array.isArray(evalData.criteria)
      ? (evalData.criteria as Criterion[]).map((criterion: any) => {
          return {
            id: criterion.id,
            name: criterion.name,
            score: typeof criterion.score === 'number' ? criterion.score : 0,
            maxScore: typeof criterion.maxScore === 'number' ? criterion.maxScore : 4,
            feedback: (criterion.feedback || criterion.justification || '').toString(),
            evidence: Array.isArray(criterion.evidence) ? criterion.evidence : [],
            strengths: Array.isArray(criterion.strengths) ? criterion.strengths : [],
            weaknesses: Array.isArray(criterion.weaknesses) ? criterion.weaknesses : [],
            actions: Array.isArray(criterion.actions) ? criterion.actions : [],
            justification: criterion.justification || '',
            weight: typeof criterion.weight === 'number' ? criterion.weight : undefined,
            rawScore: typeof criterion.rawScore === 'number' ? criterion.rawScore : undefined,
            indicators: Array.isArray(criterion.indicators) ? criterion.indicators : [],
            description: criterion.description || ''
          };
        })
      : evalData.scores
        ? Object.entries(evalData.scores).map(([key, score]) => {
            return {
              id: key,
              name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
              score: typeof score === 'number' ? score : 0,
              maxScore: 4,
              feedback: evalData.comments?.[key] || 'Aucun commentaire',
              evidence: [],
              strengths: [],
              weaknesses: [],
              actions: [],
              justification: '',
              weight: undefined,
              rawScore: undefined,
              indicators: [],
              description: ''
            } as Criterion;
          })
        : [];

    return {
      ...evaluation,
      ...evalData,
      criteria: normalizedCriteria
    };
  })() : null;

  console.log('🔍 Raw evaluation data:', evaluation);
  console.log('🔍 Transformed evaluation:', transformedEvaluation);

  const overallScoreValue = transformedEvaluation
    ? typeof (transformedEvaluation as any).overall_score === 'number'
      ? (transformedEvaluation as any).overall_score
      : null
    : null;

  const llmScore = (transformedEvaluation as any)?.llmScorePercent ?? null;
  const heuristicOverall = (transformedEvaluation as any)?.heuristic?.overallPercent ?? null;

  // Calculate overall score percentage (fallback if backend did not send overall_score)
  const calculateOverallScore = (evaluation: any) => {
    console.log('📊 Evaluation data for score calculation:', evaluation);

    if (!evaluation) return 0;

    // Check if scores exist in the evaluation object - handle nested structure
    let scores: number[] = [];

    // First check if evaluation has nested evaluation object (from API response)
    const evalData = evaluation.evaluation || evaluation;

    if (evalData.scores && typeof evalData.scores === 'object') {
      scores = Object.values(evalData.scores).filter(score => typeof score === 'number') as number[];
    } else if (evalData.criteria && Array.isArray(evalData.criteria)) {
      scores = evalData.criteria.map((c: any) => c.score).filter((score: any) => typeof score === 'number');
    }

    console.log('📊 Extracted scores:', scores);

    if (scores.length === 0) return 0;

    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const maxPossibleScore = scores.length * 4;
    const percentage = Math.round((totalScore / maxPossibleScore) * 100);

    console.log(`📊 Score calculation: ${totalScore}/${maxPossibleScore} = ${percentage}%`);

    return percentage;
  };

  const fallbackOverallScore = transformedEvaluation ? calculateOverallScore(transformedEvaluation) : 0;
  // Use calculated score if overall_score from backend is 0 or missing
  const effectiveOverallScore = (typeof overallScoreValue === 'number' && overallScoreValue > 0)
    ? overallScoreValue
    : fallbackOverallScore;

  // Fetch session report (only after evaluation succeeds)
  const { data: report } = useQuery({
    queryKey: ['ecos-report', sessionId],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/ecos/sessions/${sessionId}/report?email=${email}`);
        return response.report;
      } catch (err: any) {
        if (typeof err.message === 'string' && err.message.startsWith('404')) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!evaluation, // Only run after evaluation exists
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1 // Retry once if it fails (race condition)
  });

  const strengths = report?.strengths ?? (transformedEvaluation as any)?.feedback ?? [];
  const weaknesses = report?.weaknesses ?? (transformedEvaluation as any)?.weaknesses ?? [];
  const recommendations = report?.recommendations ?? (transformedEvaluation as any)?.recommendations ?? [];
  const heuristicDetails = (transformedEvaluation as any)?.heuristic ?? report?.heuristic ?? null;
  const summaryText = report?.summary ?? `Session évaluée automatiquement. Score LLM: ${effectiveOverallScore}%.`;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Génération de l'évaluation en cours...</p>
              <p className="text-sm text-gray-500 mt-2">
                Cette opération peut prendre quelques secondes
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    const errorMessage = error.message || 'Impossible de charger l\'évaluation';
    const isInsufficientContent = errorMessage.includes('assez d\'échanges') || errorMessage.includes('Aucune question');

    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              {isInsufficientContent ? (
                <>
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-blue-500" />
                  <h3 className="text-lg font-semibold mb-2 text-gray-800">Évaluation non disponible</h3>
                  <p className="text-gray-600 mb-4">
                    L'évaluation n'est pas disponible car la session était vide.
                  </p>
                  <p className="text-sm text-gray-500">
                    Aucune interaction entre l'étudiant et le patient n'a été enregistrée pour cette session.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                  <h3 className="text-lg font-semibold mb-2">Erreur lors du chargement</h3>
                  <p className="text-gray-600">{errorMessage}</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreIcon = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (percentage >= 60) return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Résultat Global</span>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {effectiveOverallScore}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Progress value={effectiveOverallScore} className="h-3" />
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <p className="font-medium text-gray-700">{report?.scenarioTitle || 'Évaluation ECOS'}</p>
            <p>{summaryText}</p>
            {typeof report?.transcriptMessageCount === 'number' && (
              <p className="text-xs text-gray-500">
                {report.transcriptMessageCount} échange{report.transcriptMessageCount > 1 ? 's' : ''} analysé{report.transcriptMessageCount > 1 ? 's' : ''}.
              </p>
            )}
            <p className="text-xs text-gray-500">
              Score IA&nbsp;: {effectiveOverallScore}%
              {typeof llmScore === 'number' && llmScore !== effectiveOverallScore ? ` (sortie brute ${llmScore}%)` : ''}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Criteria Scores */}
      <Card>
        <CardHeader>
          <CardTitle>Évaluation Détaillée</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {transformedEvaluation && transformedEvaluation.criteria.length > 0 ? (
            transformedEvaluation.criteria.map((criterion: Criterion) => (
              <div key={criterion.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getScoreIcon(criterion.score, criterion.maxScore)}
                    <h4 className="font-medium">{criterion.name}</h4>
                    {typeof criterion.weight === 'number' && (
                      <Badge variant="outline" className="text-xs">
                        Poids {criterion.weight}%
                      </Badge>
                    )}
                  </div>
                  <span className={`font-semibold ${getScoreColor(criterion.score, criterion.maxScore)}`}>
                    {criterion.score}/{criterion.maxScore}
                  </span>
                </div>
                <Progress value={(criterion.score / criterion.maxScore) * 100} className="mb-2" />
                <div className="space-y-2">
                  {(criterion.feedback || criterion.description) && (
                    <p className="text-sm text-gray-600">
                      {criterion.feedback || criterion.description}
                    </p>
                  )}
                  {criterion.justification && (
                    <p className="text-xs italic text-gray-500">Justification : {criterion.justification}</p>
                  )}
                  {criterion.indicators && criterion.indicators.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Indicateurs attendus : {criterion.indicators.join(', ')}
                    </p>
                  )}

                  {(criterion.strengths && criterion.strengths.length > 0) && (
                    <div className="pt-2 space-y-1">
                      <p className="text-xs font-semibold text-green-600">Points forts spécifiques :</p>
                      <ul className="space-y-1">
                        {criterion.strengths.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-green-600">
                            <CheckCircle className="w-3 h-3 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(criterion.weaknesses && criterion.weaknesses.length > 0) && (
                    <div className="pt-2 space-y-1">
                      <p className="text-xs font-semibold text-red-600">Points faibles :</p>
                      <ul className="space-y-1">
                        {criterion.weaknesses.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-red-500">
                            <XCircle className="w-3 h-3 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(criterion.actions && criterion.actions.length > 0) && (
                    <div className="pt-2 space-y-1">
                      <p className="text-xs font-semibold text-blue-600">Axes d'amélioration :</p>
                      <ul className="space-y-1">
                        {criterion.actions.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-blue-600">
                            <TrendingUp className="w-3 h-3 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {criterion.evidence && criterion.evidence.length > 0 && (
                    <div className="pt-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-600">Extraits pertinents :</p>
                      <ul className="space-y-2">
                        {criterion.evidence.map((item, idx) => (
                          <li key={idx} className="border border-gray-100 rounded-md p-2 bg-gray-50">
                            <p className="text-xs text-gray-500 mb-1">
                              <span className="font-semibold">{item.role}</span>
                              {item.timestamp && ` • ${new Date(item.timestamp).toLocaleTimeString()}`}
                            </p>
                            <p className="text-sm text-gray-700">{item.excerpt}</p>
                            <p className="text-xs text-gray-500 mt-1">Indicateur : {item.indicator}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">Aucun critère d'évaluation disponible.</p>
          )}
        </CardContent>
      </Card>

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-green-700">
              <TrendingUp className="w-5 h-5" />
              <span>Points Forts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {strengths && strengths.length > 0 ? (
              <ul className="space-y-2">
                {strengths.map((strength: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">Aucun point fort identifié.</p>
            )}
          </CardContent>
        </Card>

        {/* Weaknesses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-700">
              <TrendingDown className="w-5 h-5" />
              <span>Points à Améliorer</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weaknesses && weaknesses.length > 0 ? (
              <ul className="space-y-2">
                {weaknesses.map((weakness: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{weakness}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">Aucune faiblesse identifiée.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommandations pour l'Amélioration</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recommendations.map((recommendation: string, index: number) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <span className="text-gray-700">{recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
