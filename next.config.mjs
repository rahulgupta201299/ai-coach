/** @type {import('next').NextConfig} */
const nextConfig = {
  // Make sure the coaching content files ship with the server build.
  outputFileTracingIncludes: {
    "/api/**": ["./content/**"],
  },
};

export default nextConfig;
