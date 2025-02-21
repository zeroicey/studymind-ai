# 使用 Node.js 18 作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建 TypeScript 代码
RUN npm run build

# 暴露端口
EXPOSE 4000

# 设置环境变量
ENV NODE_ENV=production \
    PORT=4000

# 启动应用
CMD ["npm", "start"]
