# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Animal Aura Quiz

The AniMatch app includes a personality quiz feature that matches users with their "Animal Aura" based on their responses to 10 questions. Each question has 4 possible answers, and the cumulative pattern of responses determines which of 15 animal auras best represents the user's personality.

### Quiz Features:

- **10 Personality Questions**: Answer thoughtful questions about your personality, preferences, and behavior
- **Real-time Progress Tracking**: See which question you're on and your overall progress
- **Interactive UI**: Clear, engaging interface with animated selection states
- **Results Analysis**: Algorithm that processes your answers to find your matching animal aura
- **Detailed Aura Profiles**: Each animal aura includes a description, strengths, challenges, and key traits
- **Result Sharing**: Share your animal aura with friends on social media
- **Retake Option**: Take the quiz again if you'd like to explore other possibilities

### Technical Implementation:

- Data stored in Supabase database tables
- Secure user authentication integration
- Optimized for mobile with responsive design
- Smooth transitions between questions
- State persistence during quiz progress
