import z from 'zod'

export const DeploymentEnvSchema = z.enum([
    'dev',
    'staging',
    'prod',
]);
export type DeploymentEnv = z.infer<typeof DeploymentEnvSchema>;