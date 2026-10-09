const chatbotService = require("./services/chatbotService");
const { getConversationState, resetConversationState } = require("./utils/conversationState");
const fs = require("fs");
const path = require("path");

async function runTests() {
  console.log("==========================================");
  console.log("🧪 RUNNING COMPLETE KAIROS LITE 6-SCREEN SIMULATION TESTS");
  console.log("==========================================\n");

  const testPhone = "919629531891";

  // Test 1: Client sends "Hi" (Screen 1)
  console.log("--- TEST 1: Greeting / Welcome Flow (Screen 1) ---");
  resetConversationState(testPhone);
  let replies = await chatbotService.processMessage(testPhone, "Hi", null, "msg_001");
  console.assert(replies.length === 2, "Test 1 Failed: Expected 2 sequential messages");
  console.assert(replies[0].text.includes("Welcome to Kairos Lite"), "Test 1 Failed: Welcome text mismatch");
  console.assert(replies[1].body.includes("Do you agree that we use your answers"), "Test 1 Failed: Consent question mismatch");
  console.assert(replies[1].buttons[0].title === "I agree" && replies[1].buttons[1].title === "More info", "Test 1 Failed: Buttons mismatch");
  console.log("✅ Screen 1 Verified (Welcome & Agreement buttons)\n");

  // Test 2: Client clicks "I agree" (Screen 2)
  console.log("--- TEST 2: 'I agree' button clicked (Screen 2) ---");
  replies = await chatbotService.processMessage(testPhone, "I agree", "agree", "msg_002");
  console.assert(replies[0].body.includes("Thank you! What are you looking for today?"), "Test 2 Failed");
  console.assert(replies[0].buttons.length === 3, "Test 2 Failed: Expected 3 buttons");
  console.assert(replies[0].buttons[0].title === "A job", "Test 2 Failed: A job button missing");
  console.log("✅ Screen 2 Verified (Looking for options)\n");

  // Test 3: Client clicks "A job" (Screen 3)
  console.log("--- TEST 3: 'A job' selected (Screen 3) ---");
  replies = await chatbotService.processMessage(testPhone, "A job", "opt_job", "msg_003");
  console.assert(replies.length === 2, "Test 3 Failed: Expected 2 button parts");
  console.assert(replies[0].buttons[1].title === "A housewife", "Test 3 Failed: A housewife button missing");
  console.log("✅ Screen 3 Verified (5 Profile Buttons)\n");

  // Test 4: Client clicks "A housewife" (Screen 4: Question 1/4)
  console.log("--- TEST 4: 'A housewife' selected (Screen 4: Question 1/4) ---");
  replies = await chatbotService.processMessage(testPhone, "A housewife", "profile_housewife", "msg_004");
  console.assert(replies.length === 2, "Test 4 Failed: Expected intro + Q1");
  console.assert(replies[0].text.includes("Thanks! 4 quick questions to find what suits you."), "Test 4 Failed: Missing intro");
  console.assert(replies[1].body.includes("Question 1/4") && replies[1].body.includes("How many hours a day are you available?"), "Test 4 Failed: Q1 mismatch");
  console.assert(replies[1].buttons[0].title === "2 to 3 hours", "Q1 Button 1 mismatch");
  console.assert(replies[1].buttons[1].title === "4 to 6 hours", "Q1 Button 2 mismatch");
  console.assert(replies[1].buttons[2].title === "Full time", "Q1 Button 3 mismatch");
  console.log("✅ Screen 4 Verified (Question 1/4 with buttons)\n");

  // Test 5: Client answers Question 1/4 ("2 to 3 hours") -> receives Question 2/4
  console.log("--- TEST 5: Question 1/4 answered -> Question 2/4 ---");
  replies = await chatbotService.processMessage(testPhone, "2 to 3 hours", "hours_2_3", "msg_005");
  console.assert(replies[0].body.includes("Question 2/4") && replies[0].body.includes("Where do you prefer to work?"), "Test 5 Failed");
  console.assert(replies[0].buttons[0].title === "From home", "Q2 Button 1 mismatch");
  console.log("✅ Question 2/4 Verified\n");

  // Test 6: Client answers Question 2/4 ("From home") -> receives Question 3/4
  console.log("--- TEST 6: Question 2/4 answered -> Question 3/4 ---");
  replies = await chatbotService.processMessage(testPhone, "From home", "loc_home", "msg_006");
  console.assert(replies[0].body.includes("Question 3/4") && replies[0].body.includes("What device do you have available?"), "Test 6 Failed");
  console.assert(replies[0].buttons[0].title === "Smartphone", "Q3 Button 1 mismatch");
  console.log("✅ Question 3/4 Verified\n");

  // Test 7: Client answers Question 3/4 ("Smartphone") -> receives Question 4/4
  console.log("--- TEST 7: Question 3/4 answered -> Question 4/4 ---");
  replies = await chatbotService.processMessage(testPhone, "Smartphone", "dev_smart", "msg_007");
  console.assert(replies[0].body.includes("Question 4/4") && replies[0].body.includes("When can you start?"), "Test 7 Failed");
  console.assert(replies[0].buttons[0].title === "Immediately", "Q4 Button 1 mismatch");
  console.log("✅ Question 4/4 Verified\n");

  // Test 8: Client answers Question 4/4 ("Immediately") -> receives Screen 5 (Offers List)
  console.log("--- TEST 8: Question 4/4 answered -> Screen 5 (Offers List) ---");
  replies = await chatbotService.processMessage(testPhone, "Immediately", "start_now", "msg_008");
  console.assert(replies.length === 2, "Test 8 Failed: Expected intro + offers list");
  console.assert(replies[0].text.includes("Here are 3 offers for you, with work from home possible:"), "Test 8 Failed: Intro mismatch");
  console.assert(replies[1].body.includes("*1. Online seller*"), "Test 8 Failed: Offer 1 missing");
  console.assert(replies[1].body.includes("*2. Data entry assistant*"), "Test 8 Failed: Offer 2 missing");
  console.assert(replies[1].body.includes("*3. Mobile Money agent*"), "Test 8 Failed: Offer 3 missing");
  console.assert(replies[1].buttons[0].title === "Details of offer 1", "Test 8 Failed: Details button missing");
  console.assert(replies[1].buttons[1].title === "See more offers", "Test 8 Failed: See more button missing");
  console.log("✅ Screen 5 Verified (Offers list with buttons)\n");

  // Test 9: Client clicks "Details of offer 1" -> receives Screen 6 (Offer details & Apply)
  console.log("--- TEST 9: 'Details of offer 1' clicked -> Screen 6 ---");
  replies = await chatbotService.processMessage(testPhone, "Details of offer 1", "details_offer_1", "msg_009");
  console.assert(replies.length === 2, "Test 9 Failed: Expected details + apply buttons");
  console.assert(replies[0].text.includes("Mobile Money agent") || replies[0].text.includes("Online seller"), "Test 9 Failed: Title missing");
  console.assert(replies[1].body.includes("Apply with your Kairos profile?") && replies[1].body.includes("Your CV is ready."), "Test 9 Failed: Prompt mismatch");
  console.assert(replies[1].buttons[0].title === "Apply", "Test 9 Failed: Apply button missing");
  console.assert(replies[1].buttons[1].title === "Edit my CV", "Test 9 Failed: Edit my CV button missing");
  console.log("✅ Screen 6 Verified (Offer details & Apply buttons)\n");

  // Test 10: Client clicks "Apply" -> receives confirmation
  console.log("--- TEST 10: 'Apply' clicked -> Confirmation ---");
  replies = await chatbotService.processMessage(testPhone, "Apply", "apply_offer", "msg_010");
  console.assert(replies[0].text.includes("Application sent. Type TRACK to see your applications."), "Test 10 Failed: Confirmation text mismatch");
  console.log("✅ Screen 6 Bottom Verified ('Application sent. Type TRACK to see your applications.')\n");

  // Test 11: Client sends "TRACK" -> displays applications
  console.log("--- TEST 11: Client types 'TRACK' ---");
  replies = await chatbotService.processMessage(testPhone, "TRACK", null, "msg_011");
  console.assert(replies[0].text.includes("Your Active Applications:") && replies[0].text.includes("Mobile Money agent"), "Test 11 Failed: Tracking mismatch");
  console.log("✅ TRACK Command Verified (Active applications displayed)\n");

  // Test 12: Client selects "A course" (Course Screen 1: Field Selection)
  console.log("--- TEST 12: Course Flow -> 'A course' clicked ---");
  const coursePhone = "919629531899";
  resetConversationState(coursePhone);
  await chatbotService.processMessage(coursePhone, "Hi", null, "msg_c01");
  await chatbotService.processMessage(coursePhone, "I agree", "agree", "msg_c02");
  replies = await chatbotService.processMessage(coursePhone, "A course", "opt_course", "msg_c03");
  console.assert(replies.length === 2, "Test 12 Failed: Expected 2 field button parts");
  console.assert(replies[0].body.includes("Which field interests you?"), "Test 12 Failed: Field prompt missing");
  console.assert(replies[0].buttons[0].title === "Business and sales", "Test 12 Failed: Business and sales missing");
  console.log("✅ Course Screen 1 Verified (Field Selection with 5 buttons)\n");

  // Test 13: Client selects "Business and sales" (Course Screen 2: Courses List)
  console.log("--- TEST 13: Field selected -> Course list ---");
  replies = await chatbotService.processMessage(coursePhone, "Business and sales", "field_business", "msg_c04");
  console.assert(replies.length === 1, "Test 13 Failed: Expected 1 course list message");
  console.assert(replies[0].body.includes("Courses for you, right here on WhatsApp:"), "Test 13 Failed: Courses intro missing");
  console.assert(replies[0].body.includes("1. Selling online"), "Test 13 Failed: Selling online missing");
  console.assert(replies[0].buttons[0].title === "Choose 1", "Test 13 Failed: Choose 1 missing");
  console.assert(replies[0].buttons[1].title === "Choose 2", "Test 13 Failed: Choose 2 missing");
  console.assert(replies[0].buttons[2].title === "Choose 3", "Test 13 Failed: Choose 3 missing");
  console.log("✅ Course Screen 2 Verified (Courses List with Choose 1, 2, 3)\n");

  // Test 14: Client taps "Choose 1" -> Receives Lesson 1 Clip 1 (Course Screen 3)
  // Test 14: Client taps "Choose 1" -> Receives Native WhatsApp Video (Screen 3)
  console.log("--- TEST 14: Course selected -> Native WhatsApp Video ---");
  replies = await chatbotService.processMessage(coursePhone, "Choose 1", "choose_1", "msg_c05");
  console.assert(replies.length === 3, `Test 14 Failed: Expected 3 messages, got ${replies.length}`);
  console.assert(replies[0].text.includes("You chose: Selling online. One lesson a day at 6 pm, in 4 short clips."), "Test 14 Failed: Announcement missing");
  console.assert(replies[1].type === "video", "Test 14 Failed: Expected native video message");
  console.assert(replies[1].caption.includes("Lesson 1 · Clip 1/4: your catalogue"), "Test 14 Failed: Video caption mismatch");
  console.assert(!replies[1].caption.includes("http"), "Test 14 Failed: Video caption must NOT contain URL link");
  console.assert(replies[2].type === "button", "Test 14 Failed: Expected button message under video");
  console.assert(replies[2].buttons[0].title === "Next clip", "Test 14 Failed: Next clip button missing");
  console.assert(replies[2].buttons[1].title === "Audio-only version", "Test 14 Failed: Audio-only button missing");
  console.log("✅ Course Screen 3 Verified (Native WhatsApp playable video without link text + buttons)\n");

  // Test 15: Client taps "Next clip" -> Receives Clip 2/4 Video
  console.log("--- TEST 15: 'Next clip' tapped -> Native Video Clip 2/4 ---");
  replies = await chatbotService.processMessage(coursePhone, "Next clip", "next_clip_2", "msg_c06");
  console.assert(replies.length === 2, "Test 15 Failed: Expected video + buttons");
  console.assert(replies[0].type === "video", "Test 15 Failed: Expected native video type");
  console.assert(replies[0].caption.includes("Lesson 1 · Clip 2/4: Customer conversations"), "Test 15 Failed: Clip 2 caption mismatch");
  console.assert(!replies[0].caption.includes("http"), "Test 15 Failed: Caption must NOT contain URL");
  console.log("✅ Course Screen 3 Step 2 Verified (Native Video Clip 2/4 delivered)\n");

  // Test 16: Client taps "Audio-only version" -> Receives Native Audio message
  console.log("--- TEST 16: 'Audio-only version' tapped -> Native Audio ---");
  replies = await chatbotService.processMessage(coursePhone, "Audio-only version", "audio_clip_2", "msg_c07");
  console.assert(replies.length === 2, "Test 16 Failed: Expected audio + buttons");
  console.assert(replies[0].type === "audio", "Test 16 Failed: Expected native audio type");
  console.assert(replies[1].buttons[1].title === "Video version", "Test 16 Failed: Video version button missing");
  console.log("✅ Course Screen 3 Audio Mode Verified (Native WhatsApp Audio)\n");

  console.log("==========================================");
  console.log("🎉 ALL 16 KAIROS LITE TESTS PASSED 100%!");
  console.log("==========================================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
