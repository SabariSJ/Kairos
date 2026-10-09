const fs = require("fs");
const path = require("path");
const { KAIROS_CONFIG, JOB_CATALOG } = require("../data/kairosData");
const aiService = require("./aiService");
const {
  getConversationState,
  updateConversationState,
  resetConversationState,
  saveLead,
  getCandidateApplications
} = require("../utils/conversationState");

/**
 * Clean incoming user text
 */
function cleanText(text) {
  return (text || "").trim().toLowerCase();
}

/**
 * Detect if the message is a greeting or restart command
 */
function isGreetingOrRestart(clean, buttonId) {
  if (buttonId === "restart" || buttonId === "start") return true;
  const triggers = [
    "hi",
    "hello",
    "hey",
    "start",
    "restart",
    "menu",
    "kairos",
    "bonjour",
    "salut",
    "bonsoir",
    "commencer",
    "recommencer",
    "vanakkam",
    "namaste"
  ];
  return triggers.includes(clean);
}

/**
 * Detect looking for selection from text or button ID
 */
function detectLookingFor(clean, buttonId) {
  if (buttonId === "opt_job") return "A job";
  if (buttonId === "opt_internship") return "An internship";
  if (buttonId === "opt_course") return "A course";

  if (clean === "a job" || clean === "job" || clean === "jobs" || clean === "1") {
    return "A job";
  }
  if (clean === "an internship" || clean === "internship" || clean === "intern" || clean === "2") {
    return "An internship";
  }
  if (clean === "a course" || clean === "course" || clean === "courses" || clean === "training" || clean === "3") {
    return "A course";
  }

  return null;
}

/**
 * Detect profile selection from text or button ID
 */
function detectProfile(clean, buttonId) {
  if (buttonId === "profile_student") return "A student";
  if (buttonId === "profile_housewife") return "A housewife";
  if (buttonId === "profile_young_woman") return "A young woman";
  if (buttonId === "profile_professional") return "A working professional";
  if (buttonId === "profile_job_seeker") return "A job seeker";

  if (clean === "a student" || clean === "student" || clean === "college student" || clean === "1") {
    return "A student";
  }
  if (clean === "a housewife" || clean === "housewife" || clean === "homemaker" || clean === "2") {
    return "A housewife";
  }
  if (clean === "a young woman" || clean === "young woman" || clean === "woman" || clean === "3") {
    return "A young woman";
  }
  if (clean.includes("professional") || clean.includes("working") || clean === "4") {
    return "A working professional";
  }
  if (clean.includes("seeker") || clean.includes("job seeker") || clean === "5") {
    return "A job seeker";
  }

  return null;
}

/**
 * Detect course field selection from text or button ID
 */
function detectCourseField(clean, buttonId) {
  if (buttonId === "field_business" || clean.includes("business") || clean.includes("sales") || clean === "1") {
    return "Business and sales";
  }
  if (buttonId === "field_sewing" || clean.includes("sewing") || clean.includes("fashion") || clean === "2") {
    return "Sewing and fashion";
  }
  if (buttonId === "field_digital" || clean.includes("digital") || clean.includes("skills") || clean === "3") {
    return "Digital skills";
  }
  if (buttonId === "field_food" || clean.includes("food") || clean.includes("catering") || clean === "4") {
    return "Food and catering";
  }
  if (buttonId === "field_small_biz" || clean.includes("small") || clean.includes("management") || clean === "5") {
    return "Small business management";
  }
  return "Business and sales";
}

/**
 * Detect course choice (Choose 1, Choose 2, Choose 3)
 */
function detectCourseSelection(clean, buttonId) {
  if (buttonId === "choose_1" || clean.includes("selling") || clean.includes("online") || clean === "1" || clean === "choose 1") {
    return "choose_1";
  }
  if (buttonId === "choose_2" || clean.includes("shop") || clean.includes("small shop") || clean === "2" || clean === "choose 2") {
    return "choose_2";
  }
  if (buttonId === "choose_3" || clean.includes("excel") || clean.includes("basic excel") || clean === "3" || clean === "choose 3") {
    return "choose_3";
  }
  return "choose_1";
}

/**
 * Course Screen 1: Field Selection
 */
function getCourseFieldsMessage() {
  return [
    {
      type: "button",
      body: KAIROS_CONFIG.courseFlow.fieldQuestion,
      buttons: KAIROS_CONFIG.courseFlow.fieldButtonsPart1
    },
    {
      type: "button",
      body: "More fields:",
      buttons: KAIROS_CONFIG.courseFlow.fieldButtonsPart2
    }
  ];
}

/**
 * Course Screen 2: Courses List
 */
function getCourseListMessage() {
  return [
    {
      type: "button",
      body: KAIROS_CONFIG.courseFlow.coursesIntro,
      buttons: KAIROS_CONFIG.courseFlow.courseButtons
    }
  ];
}

/**
 * Resolve direct video or audio URL
 */
function resolveMediaUrl(url, fallbackFilename = "french.mp4") {
  const serverBase = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_BASE_URL || "https://kairos-1ec3.onrender.com";
  
  if (url) {
    const filename = path.basename(url);
    const localPath = path.join(__dirname, "..", "public", "media", filename);
    if (fs.existsSync(localPath)) {
      return `${serverBase}/media/${filename}`;
    }
    if (url.startsWith("https://") && !url.includes("kairos-lite.org")) {
      return url;
    }
  }

  return `${serverBase}/media/${fallbackFilename}`;
}

/**
 * Course Screen 3: Lessons & Video/Audio Clips
 */
function getCourseLessonSequence(courseKey = "choose_1", clipNum = 1, isAudio = false) {
  const catalog = KAIROS_CONFIG.courseFlow.courseCatalog;
  const course = catalog[courseKey] || catalog.choose_1;
  const clip = course.clips.find(c => c.clipNumber === clipNum) || course.clips[0];

  const messages = [];

  // If clip 1 and video mode, prepend the selection announcement
  if (clipNum === 1 && !isAudio) {
    messages.push({
      type: "text",
      text: course.intro
    });
  }

  const isLastClip = clipNum >= course.clips.length;
  const nextClipId = isLastClip ? "course_done" : `next_clip_${clipNum + 1}`;
  const nextClipTitle = isLastClip ? "Finish course" : "Next clip";

  if (isAudio) {
    // 1. Native WhatsApp playable audio message
    messages.push({
      type: "audio",
      url: resolveMediaUrl(clip.audioUrl, "sample_audio.mp3")
    });

    // 2. Buttons directly under audio
    messages.push({
      type: "button",
      body: `🎧 *${clip.label}* (Audio-only version)`,
      buttons: [
        { id: nextClipId, title: nextClipTitle },
        { id: `video_clip_${clipNum}`, title: "Video version" }
      ]
    });
  } else {
    // 1. Native WhatsApp playable video message (Plays directly in WhatsApp, NO link shown)
    messages.push({
      type: "video",
      url: resolveMediaUrl(clip.url, "kairos_lesson.mp4"),
      caption: `*${clip.label}*\n${clip.duration}`
    });

    // 2. Action buttons directly under video
    messages.push({
      type: "button",
      body: "Choose an option to continue:",
      buttons: [
        { id: nextClipId, title: nextClipTitle },
        { id: `audio_clip_${clipNum}`, title: "Audio-only version" }
      ]
    });
  }

  return messages;
}

/**
 * Screen 1: Welcome & Consent (French Flow with Poster Image)
 */
function getWelcomeSequence() {
  const posterUrl = resolveMediaUrl(KAIROS_CONFIG.posterImage || "programme_poster.jpg", "programme_poster.jpg");
  return [
    {
      type: "text",
      text: KAIROS_CONFIG.welcomeMessage
    },
    {
      type: "image",
      url: posterUrl
    },
    {
      type: "button",
      body: KAIROS_CONFIG.consentQuestion,
      buttons: KAIROS_CONFIG.consentButtons
    }
  ];
}

// Active background timers for delayed subscription prompt after video playback
const activeVideoTimers = new Map();

/**
 * Schedule automated subscription prompt after demo video finishes playing
 */
function scheduleSubscriptionPrompt(phone, delaySeconds = 30) {
  if (activeVideoTimers.has(phone)) {
    clearTimeout(activeVideoTimers.get(phone));
  }

  console.log(`[Demo Video Timer] Scheduled subscription prompt for +${phone} in ${delaySeconds}s (video playback duration)`);

  const timer = setTimeout(async () => {
    activeVideoTimers.delete(phone);
    const state = getConversationState(phone);
    // Only dispatch if user is still in WATCHING_DEMO_VIDEO state
    if (state.step === "WATCHING_DEMO_VIDEO") {
      console.log(`[Demo Video Timer Fired] Video playback finished for +${phone}. Sending Accept button.`);
      updateConversationState(phone, { step: "AWAITING_SUBSCRIPTION_DECISION" });
      const conf = KAIROS_CONFIG.demoVideo || {};
      try {
        const whatsappService = require("./whatsappService");
        await whatsappService.sendButtonMessage(
          phone,
          conf.subscriptionQuestion || "Souhaitez-vous vous inscrire à notre cours ?",
          conf.buttons || [
            { id: "sub_accept", title: "J'accepte" }
          ]
        );
      } catch (err) {
        console.error("[Subscription Prompt Timer Error]", err.message);
      }
    }
  }, Math.max(delaySeconds, 1) * 1000);

  activeVideoTimers.set(phone, timer);
}

/**
 * Cancel active video timer if user responds earlier or restarts
 */
function cancelSubscriptionTimer(phone) {
  if (activeVideoTimers.has(phone)) {
    clearTimeout(activeVideoTimers.get(phone));
    activeVideoTimers.delete(phone);
    console.log(`[Demo Video Timer Cancelled] Timer cleared for +${phone}`);
  }
}

/**
 * Demo Video Message (Sent 1st, ALONE)
 */
function getDemoVideoMessage() {
  const conf = KAIROS_CONFIG.demoVideo || {};
  const videoUrl = resolveMediaUrl(conf.filename || "french.mp4", "french.mp4");
  return [
    {
      type: "video",
      url: videoUrl,
      caption: conf.caption || "Commencer gratuitement"
    }
  ];
}

/**
 * Subscription Question & Buttons Message (Sent AFTER video finishes playing)
 */
function getSubscriptionQuestionMessage() {
  const conf = KAIROS_CONFIG.demoVideo || {};
  return [
    {
      type: "button",
      body: conf.subscriptionQuestion || "Souhaitez-vous vous inscrire à notre cours ?",
      buttons: conf.buttons || [
        { id: "sub_accept", title: "J'accepte" }
      ]
    }
  ];
}

/**
 * Course Registration Form Message
 */
function getRegistrationFormMessage() {
  const conf = KAIROS_CONFIG.demoVideo || {};
  return [
    {
      type: "button",
      body: conf.registrationPrompt || "Great! Please fill out the registration form to subscribe to our course:\n\n👉 https://reg-feandsme-sprout.web.app/registration\n\nOnce submitted, return here and tap below!",
      buttons: conf.registrationButtons || [
        { id: "form_submitted", title: "Submitted ✅" }
      ]
    }
  ];
}

/**
 * Thank You After Form Submission Message
 */
function getThankYouContactMessage() {
  const conf = KAIROS_CONFIG.demoVideo || {};
  return [
    {
      type: "text",
      text: conf.thankYouMessage || "Thank you, we will contact you shortly."
    }
  ];
}

/**
 * Screen 2: Looking For (Buttons)
 */
function getLookingForMessage() {
  return [
    {
      type: "button",
      body: KAIROS_CONFIG.lookingForQuestion,
      buttons: KAIROS_CONFIG.lookingForButtons
    }
  ];
}

/**
 * Screen 3: User Profile Buttons
 */
function getProfileMessage() {
  return [
    {
      type: "button",
      body: KAIROS_CONFIG.profileQuestion,
      buttons: KAIROS_CONFIG.profileButtonsPart1
    },
    {
      type: "button",
      body: "More profile options:",
      buttons: KAIROS_CONFIG.profileButtonsPart2
    }
  ];
}

/**
 * Screen 4: Question 1/4 (Next-to-Next)
 */
function getQuestion1Sequence() {
  const q1 = KAIROS_CONFIG.questions[0];
  return [
    {
      type: "text",
      text: KAIROS_CONFIG.questionsIntro
    },
    {
      type: "button",
      body: q1.prompt,
      buttons: q1.buttons
    }
  ];
}

/**
 * Screen 5: Offers List
 */
function getOffersListSequence() {
  return [
    {
      type: "text",
      text: KAIROS_CONFIG.offersIntro
    },
    {
      type: "button",
      body: KAIROS_CONFIG.offersListBody,
      buttons: KAIROS_CONFIG.offersButtons
    }
  ];
}

/**
 * Screen 6: Offer Details & Apply
 */
function getOfferDetailsSequence() {
  return [
    {
      type: "text",
      text: `${KAIROS_CONFIG.offerDetailsMobileMoney.title}\n${KAIROS_CONFIG.offerDetailsMobileMoney.meta}`
    },
    {
      type: "button",
      body: KAIROS_CONFIG.offerDetailsMobileMoney.applyPrompt,
      buttons: KAIROS_CONFIG.offerDetailsMobileMoney.buttons
    }
  ];
}

/**
 * Screen 6 Helper: Handle "Ask Kairos AI" Q&A
 */
async function handleAskAIResponse(phone, state, text, buttonId) {
  let query = text;
  if (buttonId === "ai_eligible") query = "Am I eligible for this role?";
  if (buttonId === "ai_suitable") query = "Why is this job suitable for me?";

  const selectedOfferName = state.collectedData?.selectedOffer || "Mobile Money agent";
  const selectedJob = JOB_CATALOG.find(j => j.title.toLowerCase().includes(selectedOfferName.toLowerCase())) || JOB_CATALOG[2];

  const aiResp = await aiService.askKairosAI(state.collectedData || {}, selectedJob, query);
  if (aiResp && aiResp.messageText && aiResp.buttons?.length > 0) {
    return [
      {
        type: "button",
        body: aiResp.messageText,
        buttons: aiResp.buttons
      }
    ];
  }

  // Graceful Fallback if AI disabled or offline
  return [
    {
      type: "button",
      body: `💡 *Kairos AI Advisor:*\n\nBased on your profile, this role matches candidates looking for flexible hours. The verified employer provides free onboarding, so no prior experience is required!\n\nWould you like to apply now?`,
      buttons: [
        { id: "apply_offer", title: "Apply" },
        { id: "ask_another", title: "Ask Kairos AI" },
        { id: "see_more_offers", title: "Other offers" }
      ]
    }
  ];
}

/**
 * Main Chatbot Engine for Kairos Lite
 * 
 * @param {string} phone Customer WhatsApp phone number
 * @param {string} userMessage Raw text received from customer
 * @param {string|null} buttonId ID of button clicked if interactive
 * @param {string} messageId Meta incoming message ID
 * @returns {Promise<Array<object>>} Array of messages to send sequentially
 */
async function processMessage(phone, userMessage = "", buttonId = null, messageId = null) {
  const state = getConversationState(phone);
  const text = (userMessage || "").trim();
  const clean = cleanText(text);

  console.log(`[Kairos Chatbot] From: +${phone} | Step: ${state.step} | Input: "${text}" | ButtonID: ${buttonId || "none"}`);

  // 1. Check if user sent TRACK command anytime
  if (clean === "track" || buttonId === "track") {
    const apps = getCandidateApplications(phone);
    if (apps.length > 0) {
      let list = apps.map((a, i) => `${i + 1}. *${a.appliedOffer || "Mobile Money agent"}*\n   Status: *Under Review* ✅\n   Employer: Verified Employer\n   Applied with: Kairos Profile`).join("\n\n");
      return [
        {
          type: "text",
          text: `📋 *Your Active Applications:*\n\n${list}\n\nWe will notify you here when the employer updates your status!\nType *Hi* to search for more offers.`
        }
      ];
    } else {
      return [
        {
          type: "text",
          text: "📋 You have not submitted any applications yet.\n\nType *Hi* to explore and apply to verified free offers!"
        }
      ];
    }
  }

  // 2. Check if user sent Greeting or Restart anytime
  if (isGreetingOrRestart(clean, buttonId)) {
    cancelSubscriptionTimer(phone);
    resetConversationState(phone);
    updateConversationState(phone, { step: "AWAITING_AGREEMENT" });
    return getWelcomeSequence();
  }

  // 3. GLOBAL INTERACTIVE BUTTON INTERCEPTOR
  // Buttons sent to WhatsApp stay in chat history. If a user clicks any button
  // (such as "Choose 1", "Choose 2", "Choose 3", "Next clip", "Audio-only", or course fields),
  // we handle it immediately, regardless of current step or server restart.

  // 3a. Course Selection: Choose 1, Choose 2, Choose 3
  if (
    buttonId === "choose_1" ||
    buttonId === "choose_2" ||
    buttonId === "choose_3" ||
    clean === "choose 1" ||
    clean === "choose 2" ||
    clean === "choose 3" ||
    clean === "selling online" ||
    clean === "running a small shop" ||
    clean === "basic excel"
  ) {
    const courseKey = detectCourseSelection(clean, buttonId);
    updateConversationState(phone, {
      step: "COURSE_LESSONS",
      collectedData: {
        ...state.collectedData,
        courseKey,
        currentClip: 1
      }
    });
    return getCourseLessonSequence(courseKey, 1, false);
  }

  // 3b. Next Clip
  if (buttonId?.startsWith("next_clip_") || clean === "next clip" || clean === "next") {
    const courseKey = state.collectedData?.courseKey || "choose_1";
    const currentClip = state.collectedData?.currentClip || 1;
    const nextNum = buttonId?.startsWith("next_clip_")
      ? parseInt(buttonId.replace("next_clip_", ""), 10)
      : currentClip + 1;

    if (nextNum > 4) {
      resetConversationState(phone);
      return [
        {
          type: "text",
          text: "🎉 *Lesson 1 Complete!*\nYou finished all 4 clips today. Lesson 2 will arrive tomorrow at 6:00 pm.\n\nType *Hi* anytime to explore more courses or jobs!"
        }
      ];
    }

    updateConversationState(phone, {
      step: "COURSE_LESSONS",
      collectedData: { ...state.collectedData, currentClip: nextNum }
    });
    return getCourseLessonSequence(courseKey, nextNum, false);
  }

  // 3c. Audio-only clip toggle
  if (buttonId?.startsWith("audio_clip_") || clean.includes("audio-only") || clean === "audio") {
    const courseKey = state.collectedData?.courseKey || "choose_1";
    const currentClip = state.collectedData?.currentClip || 1;
    const clipNum = buttonId?.startsWith("audio_clip_")
      ? parseInt(buttonId.replace("audio_clip_", ""), 10)
      : currentClip;
    return getCourseLessonSequence(courseKey, clipNum, true);
  }

  // 3d. Video clip toggle
  if (buttonId?.startsWith("video_clip_") || clean.includes("video version") || clean === "video") {
    const courseKey = state.collectedData?.courseKey || "choose_1";
    const currentClip = state.collectedData?.currentClip || 1;
    const clipNum = buttonId?.startsWith("video_clip_")
      ? parseInt(buttonId.replace("video_clip_", ""), 10)
      : currentClip;
    return getCourseLessonSequence(courseKey, clipNum, false);
  }

  // 3e. Field Selection buttons
  if (buttonId?.startsWith("field_")) {
    const field = detectCourseField(clean, buttonId);
    updateConversationState(phone, {
      step: "COURSE_SELECTION",
      collectedData: { ...state.collectedData, field }
    });
    return getCourseListMessage();
  }

  // 3f. "A course" button
  if (buttonId === "opt_course") {
    updateConversationState(phone, {
      step: "COURSE_FIELD_SELECTION",
      collectedData: { ...state.collectedData, lookingFor: "A course" }
    });
    return getCourseFieldsMessage();
  }

  // 3g. Agree button -> Sends demo video 1st, then timer triggers subscription prompt after video playback
  if (
    buttonId === "agree" ||
    (state.step === "AWAITING_AGREEMENT" && (
      clean === "j'accepte" ||
      clean === "accepte" ||
      clean === "accepter" ||
      clean === "i agree" ||
      clean === "agree" ||
      clean === "oui" ||
      clean === "d'accord"
    ))
  ) {
    cancelSubscriptionTimer(phone);
    updateConversationState(phone, {
      step: "WATCHING_DEMO_VIDEO",
      collectedData: { ...state.collectedData, agreed: true }
    });
    const delaySec = parseInt(process.env.DEMO_VIDEO_DURATION_SECONDS || "30", 10);
    scheduleSubscriptionPrompt(phone, delaySec);
    return getDemoVideoMessage();
  }

  // 3h. More info button
  if (buttonId === "more_info" || clean === "plus d'infos" || clean === "more info" || clean === "info") {
    return [
      {
        type: "text",
        text: KAIROS_CONFIG.moreInfoText
      },
      {
        type: "button",
        body: KAIROS_CONFIG.consentQuestion,
        buttons: [
          { id: "agree", title: "J'accepte" }
        ]
      }
    ];
  }

  // 3i. Ask Kairos AI button
  if (buttonId === "ask_kairos_ai" || clean === "ask kairos ai" || clean === "ask ai") {
    updateConversationState(phone, {
      step: "ASK_AI",
      collectedData: { ...state.collectedData, selectedOffer: state.collectedData?.selectedOffer || "Mobile Money agent" }
    });
    return [
      {
        type: "button",
        body: "🤖 *Ask Kairos AI*\n\nAsk me anything about this offer! Tap a question below or type your question directly in the chat:",
        buttons: [
          { id: "ai_eligible", title: "Am I eligible?" },
          { id: "ai_suitable", title: "Why suitable for me?" },
          { id: "apply_offer", title: "Apply" }
        ]
      }
    ];
  }

  // 3j. Ask Kairos AI quick prompts
  if (buttonId === "ai_eligible" || buttonId === "ai_suitable") {
    updateConversationState(phone, { step: "ASK_AI" });
    return handleAskAIResponse(phone, state, text, buttonId);
  }

  // 3k. Subscription Accept
  if (
    buttonId === "sub_accept" ||
    buttonId === "accept" ||
    (state.step === "AWAITING_SUBSCRIPTION_DECISION" && (
      clean === "accept" ||
      clean === "accepte" ||
      clean === "j'accepte" ||
      clean === "accepter" ||
      clean === "oui" ||
      clean === "yes"
    ))
  ) {
    cancelSubscriptionTimer(phone);
    updateConversationState(phone, {
      step: "AWAITING_FORM_SUBMISSION",
      collectedData: { ...state.collectedData, subscriptionDecision: "accept" }
    });
    saveLead({
      phone: phone,
      lookingFor: "A course",
      profile: "Course Candidate",
      appliedOffer: "Course Subscription",
      status: "Interested in Course"
    });
    return getRegistrationFormMessage();
  }

  // 3l. Subscription Decline
  if (
    buttonId === "sub_decline" ||
    buttonId === "decline" ||
    (state.step === "AWAITING_SUBSCRIPTION_DECISION" && (
      clean === "decline" ||
      clean === "refuser" ||
      clean === "non"
    ))
  ) {
    cancelSubscriptionTimer(phone);
    updateConversationState(phone, {
      step: "DECLINED",
      collectedData: { ...state.collectedData, subscriptionDecision: "decline" }
    });
    const conf = KAIROS_CONFIG.demoVideo || {};
    return [
      {
        type: "text",
        text: conf.declineMessage || "Merci pour votre temps ! Si vous changez d'avis, écrivez *Bonjour* à tout moment pour voir la vidéo ou vous inscrire."
      }
    ];
  }

  // 3m. Form Submitted (button or text)
  if (
    buttonId === "form_submitted" ||
    clean === "form submitted" ||
    clean === "submitted" ||
    clean === "soumis" ||
    clean === "soumis ✅" ||
    clean === "j'ai soumis" ||
    clean === "envoyé" ||
    clean === "c'est fait"
  ) {
    updateConversationState(phone, {
      step: "FORM_COMPLETED",
      collectedData: { ...state.collectedData, formCompleted: true }
    });
    saveLead({
      phone: phone,
      lookingFor: "A course",
      profile: "Course Subscriber",
      appliedOffer: "Course Registration Form",
      status: "Form Submitted"
    });
    return getThankYouContactMessage();
  }

  // 4. Conversational State Machine
  switch (state.step) {
    case "IDLE": {
      resetConversationState(phone);
      updateConversationState(phone, { step: "AWAITING_AGREEMENT" });
      return getWelcomeSequence();
    }

    case "AWAITING_AGREEMENT": {
      if (buttonId === "more_info" || clean === "plus d'infos" || clean === "more info" || clean === "info") {
        return [
          {
            type: "text",
            text: KAIROS_CONFIG.moreInfoText
          },
          {
            type: "button",
            body: KAIROS_CONFIG.consentQuestion,
            buttons: [
              { id: "agree", title: "J'accepte" }
            ]
          }
        ];
      }

      if (
        buttonId === "agree" ||
        clean === "j'accepte" ||
        clean === "accepte" ||
        clean === "accepter" ||
        clean === "i agree" ||
        clean === "agree" ||
        clean === "yes" ||
        clean === "oui" ||
        clean === "d'accord" ||
        clean === "ok" ||
        clean === "1"
      ) {
        cancelSubscriptionTimer(phone);
        updateConversationState(phone, {
          step: "WATCHING_DEMO_VIDEO",
          collectedData: { agreed: true }
        });
        const delaySec = parseInt(process.env.DEMO_VIDEO_DURATION_SECONDS || "30", 10);
        scheduleSubscriptionPrompt(phone, delaySec);
        return getDemoVideoMessage();
      }

      return [
        {
          type: "button",
          body: KAIROS_CONFIG.consentQuestion,
          buttons: KAIROS_CONFIG.consentButtons
        }
      ];
    }

    case "WATCHING_DEMO_VIDEO": {
      // If user sends any message or taps while watching demo video, prompt them immediately
      cancelSubscriptionTimer(phone);
      updateConversationState(phone, { step: "AWAITING_SUBSCRIPTION_DECISION" });
      return getSubscriptionQuestionMessage();
    }

    case "AWAITING_SUBSCRIPTION_DECISION": {
      if (
        buttonId === "sub_accept" ||
        buttonId === "accept" ||
        clean === "accept" ||
        clean === "accepte" ||
        clean === "j'accepte" ||
        clean === "accepter" ||
        clean === "yes" ||
        clean === "oui"
      ) {
        cancelSubscriptionTimer(phone);
        updateConversationState(phone, {
          step: "AWAITING_FORM_SUBMISSION",
          collectedData: { ...state.collectedData, subscriptionDecision: "accept" }
        });
        saveLead({
          phone: phone,
          lookingFor: "A course",
          profile: "Course Candidate",
          appliedOffer: "Course Subscription",
          status: "Interested in Course"
        });
        return getRegistrationFormMessage();
      }

      if (buttonId === "sub_decline" || buttonId === "decline" || clean === "decline" || clean === "refuser" || clean === "non") {
        cancelSubscriptionTimer(phone);
        updateConversationState(phone, {
          step: "DECLINED",
          collectedData: { ...state.collectedData, subscriptionDecision: "decline" }
        });
        const conf = KAIROS_CONFIG.demoVideo || {};
        return [
          {
            type: "text",
            text: conf.declineMessage || "Merci pour votre temps ! Si vous changez d'avis, écrivez *Bonjour* à tout moment pour voir la vidéo ou vous inscrire."
          }
        ];
      }

      return getSubscriptionQuestionMessage();
    }

    case "AWAITING_FORM_SUBMISSION": {
      // User filled form and returned to WhatsApp
      updateConversationState(phone, {
        step: "FORM_COMPLETED",
        collectedData: { ...state.collectedData, formCompleted: true }
      });
      saveLead({
        phone: phone,
        lookingFor: "A course",
        profile: "Course Subscriber",
        appliedOffer: "Course Registration Form",
        status: "Form Submitted"
      });
      return getThankYouContactMessage();
    }

    case "FORM_COMPLETED": {
      return [
        {
          type: "text",
          text: "Merci, nous vous contacterons sous peu. Écrivez *Bonjour* si vous avez besoin d'autre chose !"
        }
      ];
    }

    case "DECLINED": {
      return [
        {
          type: "text",
          text: "Écrivez *Bonjour* à tout moment pour regarder la vidéo de démonstration ou vous inscrire !"
        }
      ];
    }

    case "AWAITING_LOOKING_FOR": {
      const choice = detectLookingFor(clean, buttonId);
      if (choice) {
        if (choice === "A course") {
          updateConversationState(phone, {
            step: "COURSE_FIELD_SELECTION",
            collectedData: { ...state.collectedData, lookingFor: "A course" }
          });
          return getCourseFieldsMessage();
        }

        updateConversationState(phone, {
          step: "AWAITING_PROFILE",
          collectedData: { ...state.collectedData, lookingFor: choice }
        });
        return getProfileMessage();
      }

      return [
        {
          type: "button",
          body: "Please choose what you are looking for today:",
          buttons: KAIROS_CONFIG.lookingForButtons
        }
      ];
    }

    case "COURSE_FIELD_SELECTION": {
      const field = detectCourseField(clean, buttonId);
      updateConversationState(phone, {
        step: "COURSE_SELECTION",
        collectedData: { ...state.collectedData, field }
      });
      return getCourseListMessage();
    }

    case "COURSE_SELECTION": {
      const courseKey = detectCourseSelection(clean, buttonId);
      updateConversationState(phone, {
        step: "COURSE_LESSONS",
        collectedData: {
          ...state.collectedData,
          courseKey,
          currentClip: 1
        }
      });
      return getCourseLessonSequence(courseKey, 1, false);
    }

    case "COURSE_LESSONS": {
      const courseKey = state.collectedData?.courseKey || "choose_1";
      let currentClip = state.collectedData?.currentClip || 1;

      // Allow switching courses directly from earlier Course List buttons
      if (buttonId?.startsWith("choose_") || clean.startsWith("choose ") || clean === "1" || clean === "2" || clean === "3") {
        const newCourseKey = detectCourseSelection(clean, buttonId);
        updateConversationState(phone, {
          collectedData: { ...state.collectedData, courseKey: newCourseKey, currentClip: 1 }
        });
        return getCourseLessonSequence(newCourseKey, 1, false);
      }

      // Allow switching fields from earlier field buttons
      if (buttonId?.startsWith("field_")) {
        const field = detectCourseField(clean, buttonId);
        updateConversationState(phone, {
          step: "COURSE_SELECTION",
          collectedData: { ...state.collectedData, field }
        });
        return getCourseListMessage();
      }

      if (buttonId === "opt_course") {
        updateConversationState(phone, {
          step: "COURSE_FIELD_SELECTION",
          collectedData: { ...state.collectedData, lookingFor: "A course" }
        });
        return getCourseFieldsMessage();
      }

      if (buttonId === "course_done" || clean.includes("finish") || clean.includes("done")) {
        resetConversationState(phone);
        return [
          {
            type: "text",
            text: "🎉 *Lesson 1 Complete!*\nYou finished today's session. Lesson 2 will arrive tomorrow at 6:00 pm.\n\nType *Hi* anytime to explore more courses or jobs!"
          }
        ];
      }

      if (buttonId?.startsWith("next_clip_") || clean.includes("next")) {
        const nextNum = buttonId?.startsWith("next_clip_")
          ? parseInt(buttonId.replace("next_clip_", ""), 10)
          : currentClip + 1;

        if (nextNum > 4) {
          resetConversationState(phone);
          return [
            {
              type: "text",
              text: "🎉 *Lesson 1 Complete!*\nYou finished all 4 clips today. Lesson 2 will arrive tomorrow at 6:00 pm.\n\nType *Hi* anytime to explore more courses or jobs!"
            }
          ];
        }

        updateConversationState(phone, {
          collectedData: { ...state.collectedData, currentClip: nextNum }
        });
        return getCourseLessonSequence(courseKey, nextNum, false);
      }

      if (buttonId?.startsWith("audio_clip_") || clean.includes("audio")) {
        const clipNum = buttonId?.startsWith("audio_clip_")
          ? parseInt(buttonId.replace("audio_clip_", ""), 10)
          : currentClip;
        return getCourseLessonSequence(courseKey, clipNum, true);
      }

      if (buttonId?.startsWith("video_clip_") || clean.includes("video")) {
        const clipNum = buttonId?.startsWith("video_clip_")
          ? parseInt(buttonId.replace("video_clip_", ""), 10)
          : currentClip;
        return getCourseLessonSequence(courseKey, clipNum, false);
      }

      return getCourseLessonSequence(courseKey, currentClip, false);
    }

    case "AWAITING_PROFILE": {
      const profile = detectProfile(clean, buttonId);
      if (profile) {
        updateConversationState(phone, {
          step: "QUESTION_1",
          collectedData: { profile: profile }
        });
        // Screen 4: 4 quick questions intro + Question 1/4
        return getQuestion1Sequence();
      }

      return getProfileMessage();
    }

    case "QUESTION_1": {
      // User answers Q1: How many hours a day are you available?
      let hours = "Full time";
      if (buttonId === "hours_2_3" || clean.includes("2") || clean.includes("3")) {
        hours = "2 to 3 hours";
      } else if (buttonId === "hours_4_6" || clean.includes("4") || clean.includes("6")) {
        hours = "4 to 6 hours";
      }

      const collected = { ...state.collectedData, hours: hours };
      updateConversationState(phone, {
        step: "QUESTION_2",
        collectedData: collected
      });

      // Adaptive Assessment: check GenAI
      const aiQ2 = await aiService.getAdaptiveQuestion(collected, 2);
      if (aiQ2 && aiQ2.messageText && aiQ2.buttons?.length > 0) {
        return [
          {
            type: "button",
            body: aiQ2.messageText,
            buttons: aiQ2.buttons
          }
        ];
      }

      const q2 = KAIROS_CONFIG.questions[1];
      return [
        {
          type: "button",
          body: q2.prompt,
          buttons: q2.buttons
        }
      ];
    }

    case "QUESTION_2": {
      // User answers Q2: Where do you prefer to work?
      let loc = "From home";
      if (buttonId === "loc_nearby" || clean.includes("nearby")) {
        loc = "Nearby";
      } else if (buttonId === "loc_flexible" || clean.includes("flexible")) {
        loc = "Flexible / Any";
      } else if (buttonId) {
        loc = buttonId;
      }

      const collected = { ...state.collectedData, workLocation: loc };
      updateConversationState(phone, {
        step: "QUESTION_3",
        collectedData: collected
      });

      // Adaptive Assessment: check GenAI
      const aiQ3 = await aiService.getAdaptiveQuestion(collected, 3);
      if (aiQ3 && aiQ3.messageText && aiQ3.buttons?.length > 0) {
        return [
          {
            type: "button",
            body: aiQ3.messageText,
            buttons: aiQ3.buttons
          }
        ];
      }

      const q3 = KAIROS_CONFIG.questions[2];
      return [
        {
          type: "button",
          body: q3.prompt,
          buttons: q3.buttons
        }
      ];
    }

    case "QUESTION_3": {
      // User answers Q3: What device do you have available?
      let dev = "Smartphone";
      if (buttonId === "dev_pc" || clean.includes("computer") || clean.includes("laptop")) {
        dev = "Computer / Laptop";
      } else if (buttonId === "dev_both" || clean.includes("both")) {
        dev = "Both";
      } else if (buttonId) {
        dev = buttonId;
      }

      const collected = { ...state.collectedData, device: dev };
      updateConversationState(phone, {
        step: "QUESTION_4",
        collectedData: collected
      });

      // Adaptive Assessment: check GenAI
      const aiQ4 = await aiService.getAdaptiveQuestion(collected, 4);
      if (aiQ4 && aiQ4.messageText && aiQ4.buttons?.length > 0) {
        return [
          {
            type: "button",
            body: aiQ4.messageText,
            buttons: aiQ4.buttons
          }
        ];
      }

      const q4 = KAIROS_CONFIG.questions[3];
      return [
        {
          type: "button",
          body: q4.prompt,
          buttons: q4.buttons
        }
      ];
    }

    case "QUESTION_4": {
      // User answers Q4: When can you start?
      let start = "Immediately";
      if (buttonId === "start_week" || clean.includes("week")) {
        start = "Within a week";
      } else if (buttonId === "start_month" || clean.includes("month")) {
        start = "In a month";
      } else if (buttonId) {
        start = buttonId;
      }

      const collected = { ...state.collectedData, startDate: start };
      updateConversationState(phone, {
        step: "OFFERS_LIST",
        collectedData: collected
      });

      // Personalized Job Matching via GenAI
      const aiMatch = await aiService.getPersonalizedJobMatching(collected, JOB_CATALOG);
      if (aiMatch && aiMatch.messageText && aiMatch.buttons?.length > 0) {
        return [
          {
            type: "button",
            body: aiMatch.messageText,
            buttons: aiMatch.buttons
          }
        ];
      }

      // Screen 5: Here are 3 offers for you, with work from home possible:
      return getOffersListSequence();
    }

    case "OFFERS_LIST": {
      // Check if user clicked "Details of offer 1" or asked for offer details
      if (
        buttonId === "details_offer_1" ||
        buttonId === "details_offer_3" ||
        clean.includes("detail") ||
        clean.includes("offer 1") ||
        clean.includes("offer 3") ||
        clean === "1" ||
        clean === "3"
      ) {
        updateConversationState(phone, {
          step: "OFFER_DETAILS",
          collectedData: { selectedOffer: "Mobile Money agent" }
        });
        // Screen 6: Offer details & Apply with your Kairos profile
        return getOfferDetailsSequence();
      }

      if (buttonId === "see_more_offers" || clean.includes("more") || clean.includes("see more")) {
        return [
          {
            type: "text",
            text: "Here are more verified offers for you:"
          },
          {
            type: "button",
            body: KAIROS_CONFIG.moreOffersList,
            buttons: [
              { id: "details_offer_1", title: "Details of offer 1" },
              { id: "details_offer_3", title: "Details of offer 3" }
            ]
          }
        ];
      }

      // Default re-show offers
      return getOffersListSequence();
    }

    case "OFFER_DETAILS": {
      // Check if user clicked "Ask Kairos AI"
      if (buttonId === "ask_kairos_ai" || clean === "ask kairos ai" || clean === "ask ai" || clean === "ask") {
        updateConversationState(phone, {
          step: "ASK_AI",
          collectedData: { ...state.collectedData, selectedOffer: state.collectedData?.selectedOffer || "Mobile Money agent" }
        });
        return [
          {
            type: "button",
            body: "🤖 *Ask Kairos AI*\n\nAsk me anything about this offer! Tap a question below or type your question directly in the chat:",
            buttons: [
              { id: "ai_eligible", title: "Am I eligible?" },
              { id: "ai_suitable", title: "Why suitable for me?" },
              { id: "apply_offer", title: "Apply" }
            ]
          }
        ];
      }

      // If user tapped quick AI prompts directly
      if (buttonId === "ai_eligible" || buttonId === "ai_suitable") {
        updateConversationState(phone, { step: "ASK_AI" });
        return handleAskAIResponse(phone, state, text, buttonId);
      }

      // Check if user clicked "Apply"
      if (buttonId === "apply_offer" || clean === "apply") {
        updateConversationState(phone, {
          step: "APPLIED"
        });

        const finalState = getConversationState(phone);
        saveLead({
          phone: phone,
          lookingFor: finalState.collectedData.lookingFor,
          profile: finalState.collectedData.profile,
          hours: finalState.collectedData.hours,
          workLocation: finalState.collectedData.workLocation,
          device: finalState.collectedData.device,
          startDate: finalState.collectedData.startDate,
          appliedOffer: "Mobile Money agent"
        });

        // Screen 6 bottom: Application sent. Type TRACK to see your applications.
        return [
          {
            type: "text",
            text: KAIROS_CONFIG.applicationSuccessMessage
          }
        ];
      }

      if (buttonId === "edit_cv" || clean.includes("edit") || clean.includes("cv")) {
        updateConversationState(phone, {
          step: "AWAITING_CV_UPDATE"
        });
        return [
          {
            type: "text",
            text: "Please send your updated details (e.g. your full name, location, and key skills or experience) to update your Kairos CV:"
          }
        ];
      }

      return getOfferDetailsSequence();
    }

    case "ASK_AI": {
      // User is in Ask Kairos AI mode
      if (buttonId === "apply_offer" || clean === "apply") {
        updateConversationState(phone, { step: "APPLIED" });
        const finalState = getConversationState(phone);
        saveLead({
          phone: phone,
          lookingFor: finalState.collectedData.lookingFor,
          profile: finalState.collectedData.profile,
          hours: finalState.collectedData.hours,
          workLocation: finalState.collectedData.workLocation,
          device: finalState.collectedData.device,
          startDate: finalState.collectedData.startDate,
          appliedOffer: finalState.collectedData.selectedOffer || "Mobile Money agent"
        });
        return [
          {
            type: "text",
            text: KAIROS_CONFIG.applicationSuccessMessage
          }
        ];
      }

      if (buttonId === "back_to_offers" || buttonId === "see_more_offers" || clean.includes("back")) {
        updateConversationState(phone, { step: "OFFERS_LIST" });
        return getOffersListSequence();
      }

      if (buttonId === "ask_another") {
        return [
          {
            type: "button",
            body: "🤖 *Ask Kairos AI*\n\nAsk another question or tap below:",
            buttons: [
              { id: "ai_eligible", title: "Am I eligible?" },
              { id: "ai_suitable", title: "Why suitable for me?" },
              { id: "apply_offer", title: "Apply" }
            ]
          }
        ];
      }

      // If user typed custom question or tapped prompt
      return handleAskAIResponse(phone, state, text, buttonId);
    }

    case "AWAITING_CV_UPDATE": {
      // User typed updated CV text
      updateConversationState(phone, {
        step: "OFFER_DETAILS",
        collectedData: { name: text }
      });

      return [
        {
          type: "text",
          text: "✅ Your Kairos profile CV has been updated!"
        },
        ...getOfferDetailsSequence()
      ];
    }

    case "APPLIED": {
      // Already applied -> if user sends text, guide them
      if (clean === "track") {
        const apps = getCandidateApplications(phone);
        let list = apps.map((a, i) => `${i + 1}. *${a.appliedOffer || "Mobile Money agent"}*\n   Status: *Under Review* ✅\n   Employer: Verified Employer\n   Applied with: Kairos Profile`).join("\n\n");
        return [
          {
            type: "text",
            text: `📋 *Your Active Applications:*\n\n${list}\n\nWe will notify you here when the employer updates your status!\nType *Hi* to search for more offers.`
          }
        ];
      }

      resetConversationState(phone);
      updateConversationState(phone, { step: "AWAITING_AGREEMENT" });
      return getWelcomeSequence();
    }

    default: {
      resetConversationState(phone);
      updateConversationState(phone, { step: "AWAITING_AGREEMENT" });
      return getWelcomeSequence();
    }
  }
}

module.exports = {
  processMessage,
  getWelcomeSequence,
  getLookingForMessage,
  getProfileMessage,
  getQuestion1Sequence,
  getOffersListSequence,
  getOfferDetailsSequence
};
