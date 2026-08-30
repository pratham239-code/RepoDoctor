# Use a lightweight, official Node.js runtime as the base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package configuration and source files into the container
COPY package.json ./
COPY src/ ./src/

# Force color output in the terminal if the terminal supports it
ENV FORCE_COLOR=1

# Run the CLI entrypoint directly when the container starts
ENTRYPOINT ["node", "src/main.js"]
