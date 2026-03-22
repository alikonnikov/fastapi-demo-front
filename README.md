# AI Task Tracker Frontend

This is the frontend for the AI Task Tracker application, built with React, Vite, and Tailwind CSS.

## Tech Stack

- **React 19**
- **Vite** (Build tool)
- **Tailwind CSS** (Styling)
- **React Query** (Data fetching)
- **Axios** (API client)
- **React Router** (Routing)
- **Lucide React** (Icons)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- Backend server running (see backend repository)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Configure the API URL in `vite.config.ts` or `.env` if applicable.

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Building for Production

```bash
npm run build
```

The production build will be in the `dist` folder.
