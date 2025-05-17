# Connexe Frontend

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app) and migrated to Vite.

## Project Structure

```
src/
├── assets/            # Static assets like images, fonts, etc.
│   ├── images/
│   └── fonts/
├── components/        # Reusable UI components
│   ├── common/        # Base components (buttons, inputs, modals, etc.)
│   ├── layout/        # Layout components (sidebar, navbar, footer)
│   └── ui/            # Complex UI components (avatars, logos, tabs)
├── features/          # Feature-specific components and logic
│   ├── auth/          # Authentication related components
│   ├── hub/           # Hub related components 
│   │   ├── categories/
│   │   ├── channels/
│   │   ├── chat/
│   │   ├── members/
│   │   ├── roles/
│   │   └── settings/
│   └── user/          # User profile related components
├── hooks/             # Custom React hooks
├── services/          # API services and external integrations
│   ├── api/           # API client and endpoints
│   └── websocket/     # WebSocket service
├── store/             # State management (Redux, Context)
│   ├── slices/        # Redux slices
│   └── context/       # React Context providers
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── pages/             # Page components
├── routes/            # Route definitions and guards
├── App.tsx            # Main App component
└── index.tsx          # Entry point
```

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in the development mode.\
Open [https://localhost:3001](https://localhost:3001) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `dist` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

### `npm run preview`

Locally preview the production build.

## Learn More

To learn React, check out the [React documentation](https://reactjs.org/).