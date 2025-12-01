import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 移除无效的 turbo 配置，Next.js 16 不再支持此配置
  // 如需性能优化，考虑使用 next build --turbo 或其他现代优化方式

  // 部署相关配置
  output: 'standalone',

  // 环境变量配置（部署时会被覆盖）
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // 图片优化（如果使用自定义图片域名）
  images: {
    domains: ['localhost', 'your-production-domain.com'],
  },
};

export default nextConfig;
