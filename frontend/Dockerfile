FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

EXPOSE 5173

# Default command
CMD ["npx", "vite", "--host", "0.0.0.0"]
