import { createBaselineWorktree } from './utils/createBaselineWorktree';
import { calculateDependencyDelta } from './delta/dependency-delta';
import { buildDependencyInsights } from './delta/buildDependencyInsights';
import { defaultModeReport } from './ci/reporting/defaultModeReport';
import { ciModeReport } from './ci/reporting/ciModeReport';
import { htmlModeReport } from './ci/reporting/htmlModeReport';
import { scanProject } from '@core/scanProject';
import { removeBaselineWorktree } from './utils/removeBaselineWorktree';
import { validateGitRef } from './utils/validateGitRef';

type CliAnalyzeOptions = {
    target: string;
    baselineRef: string;
    ci: boolean;
    html: boolean;
    failOn: 'warning' | 'error';
};

export async function analyzeRegression(args: CliAnalyzeOptions): Promise<boolean | null> {
    const { target, ci, html, baselineRef } = args;

    if (!validateGitRef(baselineRef) && baselineRef) {
        console.error(`Invalid git reference: ${baselineRef}`);
        process.exit(1);
    }

    const current = await scanProject(target);
    console.log(`Scanned files: ${current.scannedFiles}`);
    console.log(`Modules: ${current.graph.nodes.size}`);

    const worktree = createBaselineWorktree(baselineRef);
    const baseline = await scanProject(worktree);
    removeBaselineWorktree(worktree);

    console.log(`Scanned files: ${baseline.scannedFiles}`);
    console.log(`Modules: ${baseline.graph.nodes.size}`);

    const delta = calculateDependencyDelta({
        current,
        baseline,
    });

    /*
    const delta1: DependencyDelta = {
        added: [
            {
                from: 'src/features/regression/index.ts',
                to: 'src/features/regression/utils/createBaselineWorktree.ts',
            },

            {
                from: 'src/features/regression/index.ts',
                to: 'src/features/payments/index.ts',
            },

            {
                from: 'src/features/regression/domain/check.ts',
                to: 'src/shared/logger/index.ts',
            },

            {
                from: 'src/ui/pages/Home.tsx',
                to: 'src/infrastructure/http/client.ts',
            },

            {
                from: 'src/hooks/useAuth.ts',
                to: 'src/components/AuthModal.tsx',
            },
        ],

        removed: [],
    };

    const delta2: DependencyDelta = {
        added: [
            // internal feature growth
            {
                from: 'src/features/auth/index.ts',
                to: 'src/features/auth/utils/token.ts',
            },
            {
                from: 'src/features/auth/index.ts',
                to: 'src/features/auth/services/login.ts',
            },
            {
                from: 'src/features/auth/services/login.ts',
                to: 'src/features/auth/api/auth-api.ts',
            },

            // cross-feature dependencies
            {
                from: 'src/features/orders/index.ts',
                to: 'src/features/payments/index.ts',
            },
            {
                from: 'src/features/orders/services/create-order.ts',
                to: 'src/features/users/domain/user.ts',
            },
            {
                from: 'src/features/profile/ui/ProfilePage.tsx',
                to: 'src/features/orders/index.ts',
            },

            // shared becoming central
            {
                from: 'src/shared/logger/index.ts',
                to: 'src/infrastructure/monitoring/sentry.ts',
            },
            {
                from: 'src/shared/logger/index.ts',
                to: 'src/infrastructure/http/client.ts',
            },
            {
                from: 'src/shared/logger/index.ts',
                to: 'src/features/auth/index.ts',
            },

            // possible layer crossing
            {
                from: 'src/ui/pages/Home.tsx',
                to: 'src/infrastructure/http/client.ts',
            },
            {
                from: 'src/ui/pages/Admin.tsx',
                to: 'src/infrastructure/database/query.ts',
            },
            {
                from: 'src/hooks/useOrders.ts',
                to: 'src/infrastructure/cache/redis.ts',
            },

            // possible coupling increase
            {
                from: 'src/components/Table.tsx',
                to: 'src/components/Pagination.tsx',
            },
            {
                from: 'src/components/Table.tsx',
                to: 'src/components/Modal.tsx',
            },
            {
                from: 'src/components/Table.tsx',
                to: 'src/components/Button.tsx',
            },
            {
                from: 'src/components/Table.tsx',
                to: 'src/components/Tooltip.tsx',
            },

            // feature leakage
            {
                from: 'src/features/analytics/domain/report.ts',
                to: 'src/features/payments/infra/stripe.ts',
            },
            {
                from: 'src/features/analytics/domain/report.ts',
                to: 'src/features/notifications/email/send.ts',
            },

            // random utilities explosion
            {
                from: 'src/utils/date.ts',
                to: 'src/utils/currency.ts',
            },
            {
                from: 'src/utils/date.ts',
                to: 'src/utils/format.ts',
            },
            {
                from: 'src/utils/date.ts',
                to: 'src/utils/http.ts',
            },
            {
                from: 'src/utils/date.ts',
                to: 'src/utils/cache.ts',
            },
            {
                from: 'src/utils/date.ts',
                to: 'src/utils/logger.ts',
            },

            // infrastructure coupling
            {
                from: 'src/infrastructure/http/client.ts',
                to: 'src/infrastructure/cache/redis.ts',
            },
            {
                from: 'src/infrastructure/http/client.ts',
                to: 'src/infrastructure/database/query.ts',
            },

            // SCC-like suspicious structure
            {
                from: 'src/features/chat/index.ts',
                to: 'src/features/notifications/index.ts',
            },
            {
                from: 'src/features/notifications/index.ts',
                to: 'src/features/chat/socket.ts',
            },
        ],

        removed: [],
    };
    */

    const result = buildDependencyInsights(delta);

    defaultModeReport({ isCi: ci, isHtml: html, delta: result });
    htmlModeReport({ isHtml: html, delta: result });

    const regressionReuslt = ciModeReport({ isCi: ci, delta: result });

    return regressionReuslt;
}
