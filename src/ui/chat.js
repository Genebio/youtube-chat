import readline from "readline";
import ansiEscapes from "ansi-escapes";
import { getMessage } from "../../localization.js";
import { displayChatHeader, startThinkingSpinner, displayAssistantResponse, displayError } from "./console.js";
import { handleExportCommand, handleLangCommand } from "./prompts.js";
import { getTerminalSeparator } from "../utils/formatting.js";

/**
 * Start the interactive chat session
 * @param {Object} agent - Agent instance
 * @param {Array} conversationHistory - Array to store conversation history
 * @param {Object} videoMetadata - Video metadata object
 * @param {string} youtubeUrl - YouTube video URL
 * @param {string} locale - Current locale
 * @param {string} uiLanguage - UI language code
 * @param {string} transcriptLanguage - Transcript language code
 * @returns {Promise<void>}
 */
export async function startChat(agent, conversationHistory, videoMetadata, youtubeUrl, locale, uiLanguage, transcriptLanguage) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  displayChatHeader(uiLanguage, transcriptLanguage, locale);

  const askQuestion = () => {
    // Print top separator and prompt
    process.stdout.write(`\n${getTerminalSeparator('─')}\n> `);

    // Print bottom separator below, then move cursor back up to prompt line
    process.stdout.write('\n' + getTerminalSeparator('─'));
    process.stdout.write(ansiEscapes.cursorUp(1) + ansiEscapes.cursorTo(2));

    // Maintain bottom separator while user is typing
    const separatorInterval = setInterval(() => {
      process.stdout.write(ansiEscapes.cursorSavePosition);
      process.stdout.write(ansiEscapes.cursorDown(1) + ansiEscapes.cursorTo(0));
      process.stdout.write(getTerminalSeparator('─'));
      process.stdout.write(ansiEscapes.cursorRestorePosition);
    }, 50); // Redraw every 50ms

    rl.once('line', async (input) => {
      // Stop the separator maintenance
      clearInterval(separatorInterval);

      const userInput = input.trim();

      // Erase bottom separator
      process.stdout.write(ansiEscapes.cursorDown(1) + ansiEscapes.eraseLine);

      // Move back up to prompt line, go to beginning, erase top separator line above
      process.stdout.write(ansiEscapes.cursorUp(1) + ansiEscapes.cursorTo(0));
      process.stdout.write(ansiEscapes.cursorUp(1) + ansiEscapes.eraseLine);

      // Move back down to after the user input and print newline to continue
      process.stdout.write(ansiEscapes.cursorDown(1) + ansiEscapes.cursorTo(0));
      process.stdout.write('\n');

      if (!userInput) {
        askQuestion();
        return;
      }

      // Handle exit command
      if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
        console.log(`\n${getMessage('chat_goodbye', locale)}`);
        rl.close();
        process.exit(0);
      }

      // Handle export command
      if (userInput.toLowerCase() === "/export") {
        await handleExportCommand(rl, conversationHistory, videoMetadata, youtubeUrl, locale);
        askQuestion();
        return;
      }

      // Handle language command
      if (userInput.toLowerCase() === "/lang") {
        await handleLangCommand(rl, locale);
        askQuestion();
        return;
      }

      // Process regular user input
      try {
        conversationHistory.push({
          timestamp: new Date(),
          role: "user",
          content: userInput,
        });

        const thinkingSpinner = startThinkingSpinner(getMessage('chat_thinking', locale));

        const response = await agent.invoke({
          messages: [{ role: "user", content: userInput }],
        });

        const messages = response.messages;
        const lastMessage = messages[messages.length - 1];

        conversationHistory.push({
          timestamp: new Date(),
          role: "assistant",
          content: lastMessage.content,
          fullMessages: messages,
        });

        thinkingSpinner.stop();
        displayAssistantResponse(lastMessage.content);
      } catch (error) {
        displayError('error_general', locale, { error: error.message });
      }

      askQuestion();
    });
  };

  askQuestion();
}