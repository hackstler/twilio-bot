const express = require('express');
const bodyParser = require('body-parser');
const accountSid = '';
const authToken = '';
const OpenAI= require('openai');
const openai = new OpenAI();

const client = require('twilio')(accountSid, authToken);
console.log("🚀 ~ client:", client)



const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


const conversations = {};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getOpenAIResponse(conversationHistory) {
  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    try {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        ...conversationHistory.map(message => {
          const role = message.startsWith('User:') ? 'user' : 'assistant';
          const content = message.replace(/^(User|AI):\s*/, '');
           return { role, content };;
        }),
      ];

      console.log('Messages to OpenAI:', JSON.stringify(messages, null, 2)); // Mensaje de depuración

      const openaiResponse = await openai.chat.completions.create({
        messages,
        model: 'gpt-3.5-turbo',
        response_format: { type: 'text' },
      });
      console.log("🚀 ~ getOpenAIResponse ~ openaiResponse:", openaiResponse.choices[0].message.content.trim())


      return openaiResponse.choices[0].message.content.trim();
    } catch (error) {
      if (error.status === 429) {
        console.error('Rate limit exceeded, retrying...');
        await delay(1000 * (attempt + 1)); // Esperar un tiempo exponencial antes de reintentar
        attempt++;
      } else {
        console.error('OpenAI API Error:', error);
        throw error;
      }
    }
  }

  throw new Error('Exceeded maximum retry attempts due to rate limits.');
}

app.post('/webhook', async (req, res) => {
  const incomingMessage = req.body.Body;
  const fromNumber = req.body.From;

  if (!conversations[fromNumber]) {
    conversations[fromNumber] = [];
  }

  conversations[fromNumber].push(`User: ${incomingMessage}`);

  const conversationHistory = conversations[fromNumber];

  try {
    const replyMessage = await getOpenAIResponse(conversationHistory);
    conversations[fromNumber].push(`AI: ${replyMessage}`);
    await client.messages.create({
      body: replyMessage,
      from: 'whatsapp:+14155238886',
      to: fromNumber,
    });

 
  } catch (error) {
    console.error('Error:', error.message);
    res.sendStatus(500);
  }
});


app.listen(3002, () => console.log('Server is running on port 3000'));