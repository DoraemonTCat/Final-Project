FROM node:20

WORKDIR /app

# copy เฉพาะ package.json กับ package-lock.json
COPY package.json package-lock.json* ./

# ติดตั้ง dependencies
RUN npm install

# copy ทั้งโฟลเดอร์ source code
COPY . .

# build production
RUN npm run build

# serve build folder
CMD ["npx", "serve", "-s", "build", "-l", "3000"]