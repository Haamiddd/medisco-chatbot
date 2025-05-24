import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SendIcon from '@mui/icons-material/Send';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import EventSeatIcon from '@mui/icons-material/EventSeat';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import agnryGif from '../src/angry.gif';
import './App.scss';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';

// Import emotion faces
import happyFace from './happy.jpg';
import neutralFace from './neutral.jpg';
import angryFace from './angry.jpg';

if (!SpeechRecognition.browserSupportsSpeechRecognition()) {
  console.log('Your browser does not support speech recognition');
}


const App = () => {
  // State declarations
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeFeature, setActiveFeature] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [appointmentData, setAppointmentData] = useState({
    name: '',
    email: '',
    phone: '',
    doctorId: '',
    date: '',
    time: ''
  });
  const [availableTimes, setAvailableTimes] = useState([]);
  const [irrelevantCount, setIrrelevantCount] = useState(0);
  const [userName, setUserName] = useState('');
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  //

  const [teachingMode, setTeachingMode] = useState({
    active: false,
    currentQuestion: ''
});
  
  // Refs
  const messagesEndRef = useRef(null);
  const isProcessing = useRef(false);

  // Emotion faces mapping
  const emotionFaces = {
    happy: happyFace,
    neutral: neutralFace,
    angry: angryFace
  };

  // Speech recognition commands
  const commands = [
    {
      command: 'reset',
      callback: () => resetTranscript()
    }
  ];

  const { transcript, resetTranscript } = useSpeechRecognition({ commands });

  // Update emotion based on message content
  const updateEmotion = (message) => {
    if (!message) return;
    
    const messageStr = typeof message === 'string' ? message : 
                     (message.text && typeof message.text === 'string' ? message.text : '');
    
    if (messageStr.includes('🚨 URGENT') || messageStr.includes('⚠️ IMPORTANT') || 
        messageStr.includes('Ask proper questions') || messageStr.includes('Sorry, I encountered an error')) {
      setCurrentEmotion('angry');
    } else if (messageStr.includes('successfully') || messageStr.includes('Great') || 
               messageStr.includes('Welcome') || messageStr.includes('Hello') || 
               messageStr.includes('Hi') || messageStr.includes('Thank you')) {
      setCurrentEmotion('happy');
    } else {
      setCurrentEmotion('neutral');
    }
  };

  // Symptom checker function
  const handleSymptomCheck = async (symptoms) => {
    try {
      const response = await axios.post('http://localhost:5000/api/symptom-checker', {
        symptoms: symptoms
      });
      
      let message = response.data.recommendation;
      
      // Add urgency indicator
      if (response.data.urgency === 'high') {
        message = `🚨 URGENT: ${message}`;
      } else if (response.data.urgency === 'medium') {
        message = `⚠️ IMPORTANT: ${message}`;
      }
      
      // Check if we should recommend a doctor
      const seriousKeywords = ['chest pain', 'difficulty breathing', 'severe bleeding'];
      const needsDoctor = seriousKeywords.some(keyword => symptoms.toLowerCase().includes(keyword));
      
      if (needsDoctor || response.data.urgency === 'high') {
        // Find relevant doctors based on symptoms
        let suggestedSpecialty = 'General Physician';
        
        if (symptoms.toLowerCase().includes('chest')) {
          suggestedSpecialty = 'Cardiologist';
        } else if (symptoms.toLowerCase().includes('head')) {
          suggestedSpecialty = 'Neurologist';
        } else if (symptoms.toLowerCase().includes('stomach')) {
          suggestedSpecialty = 'Gastroenterologist';
        }
        
        const relevantDoctors = doctors.filter(doctor => 
          doctor.specialization.includes(suggestedSpecialty)
        );
        
        if (relevantDoctors.length > 0) {
          message += `\n\nI recommend seeing a ${suggestedSpecialty}. `;
          message += `Would you like to book an appointment with ${relevantDoctors[0].name}?`;
          
          // Set doctor in appointment data if user wants to book
          setAppointmentData(prev => ({
            ...prev,
            doctorId: relevantDoctors[0].id,
            doctorName: relevantDoctors[0].name
          }));
        }
      }
      
      return message;
    } catch (error) {
      console.error('Error checking symptoms:', error);
      return "Sorry, I encountered an error checking your symptoms. Please try again.";
    }
  };

  // Speech recognition handler
  const handleListen = () => {
    if (isListening) {
      SpeechRecognition.stopListening();
      resetTranscript();
      setIsListening(false);
    } else {
      SpeechRecognition.startListening({ continuous: true });
      setIsListening(true);
    }
  };

  // Initial setup
  useEffect(() => {
    // Initial greeting
    const greeting = { text: 'Hello! Welcome to Medisco Hospital. How can I assist you today?', sender: 'bot' };
    setMessages([greeting]);
    updateEmotion(greeting);
    
    // Fetch initial data
    const fetchData = async () => {
      await fetchDoctors();
      await fetchDepartments();
      await checkAppointmentReminders();
    };
    fetchData();
    
    // Set up interval for reminders
    const reminderInterval = setInterval(() => {
      checkReminders();
    }, 60000); // Check every minute

    return () => clearInterval(reminderInterval);
  }, []); 

  // Update input when speech recognition transcript changes
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Data fetching functions
  const fetchDoctors = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/doctors');
      setDoctors(response.data);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/departments');
      setDepartments(response.data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const checkAppointmentReminders = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/appointments/reminders');
      if (response.data.length > 0) {
        const reminder = response.data[0];
        const reminderMessage = {
          text: `Hi ${reminder.patient_name}! Friendly reminder: Your appointment with ${reminder.doctor_name} is on ${reminder.appointment_date} at ${reminder.appointment_time}.`,
          sender: 'bot'
        };
        setMessages(prev => [...prev, reminderMessage]);
        updateEmotion(reminderMessage);
        if (!userName) setUserName(reminder.patient_name);
      }
    } catch (error) {
      console.error('Error checking appointment reminders:', error);
    }
  };

  const checkReminders = () => {
    const now = new Date();
    const currentTime = now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    
    reminders.forEach(reminder => {
      if (reminder.time === currentTime) {
        const reminderMessage = { text: `⏰ Reminder: ${reminder.message}`, sender: 'bot' };
        setMessages(prev => [...prev, reminderMessage]);
        updateEmotion(reminderMessage);
      }
    });
  };

  const handleUserMessage = async (userInput) => {
    // Check if in teaching mode
    if (teachingMode.active) {
        // Store the answer
        try {
            await axios.post('/api/learned-facts', {
                question: teachingMode.currentQuestion,
                answer: userInput
            });
            
            const thankYouMessage = {
                text: `Thanks! I've learned that the answer to "${teachingMode.currentQuestion}" is "${userInput}".`,
                sender: 'bot'
            };
            setMessages(prev => [...prev, thankYouMessage]);
        } catch (error) {
            const errorMessage = {
                text: "I couldn't save that information. Please try again.",
                sender: 'bot'
            };
            setMessages(prev => [...prev, errorMessage]);
        }
        
        setTeachingMode({ active: false, currentQuestion: '' });
        return;
    }

    // Check for known facts
    if (userInput.toLowerCase().endsWith('?')) {
        try {
            const response = await axios.get('/api/learned-facts', {
                params: { question: userInput }
            });
            
            if (response.data.answer) {
                const answerMessage = {
                    text: `The answer is: ${response.data.answer}`,
                    sender: 'bot'
                };
                setMessages(prev => [...prev, answerMessage]);
                return;
            }
        } catch (error) {
            // Proceed to teaching mode if question not found
        }

        // If question unknown
        const teachMeMessage = {
            text: "I don't know the answer to that. Can you teach me? Please provide the answer.",
            sender: 'bot'
        };
        setMessages(prev => [...prev, teachMeMessage]);
        setTeachingMode({
            active: true,
            currentQuestion: userInput
        });
        return;
    }

    // Rest of your existing message handling...
};


  // Input change handler
  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  // Small talk handler
  const handleSmallTalk = (input) => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('how are you') || lowerInput.includes("how're you")) {
      return "I'm just a bot, but I'm functioning well! How can I assist you today?";
    }
    
    if (lowerInput.includes('tell me a joke')) {
      return "Why don't skeletons fight each other? They don't have the guts!";
    }
    
    if (lowerInput.includes('who made you') || lowerInput.includes('who created you')) {
      return "I was created by the Medisco Hospital IT team to help patients like you!";
    }
    
    if (lowerInput.includes('thank')) {
      return "You're welcome! Is there anything else I can help you with?";
    }
    
    if (lowerInput.includes('Medisco Hospital')||lowerInput.includes('location')) {
      return "Medisco Hospital is located at 123 Health Street, Medical City. Here are directions: https://maps.app.goo.gl/MwBnmwnMEiEzxVKu9";
    }
    if (lowerInput.includes('hi') || lowerInput.includes('hello') || lowerInput.includes('hey')) {
      const greetings = userName 
        ? [
            `Hello again, ${userName}! How can I help you today?`,
            `Nice to see you back, ${userName}! What can I do for you?`,
            `Hey ${userName}! Need any assistance today?`,
            `Good day$ {userName}! How can I be of service to you?`,
            `Hi ${userName}! What brings you here today?`
          ]
        : [
            "Hello there! How can I assist you today?",
            "Hi! What can I do for you today?",
            "Hey! How may I help you?",
            "Good day! How can I be of service to you?",
            "Hi there! What brings you here today?"
          ];

      return greetings[Math.floor(Math.random() * greetings.length)];
    }
    
    return null;
  };

  // When saving & fetching
  // Main message handler
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    isProcessing.current = true;

    const userInput = input;
    setInput('');
    
    // Update emotion based on user input
    if (userInput.toLowerCase().match(/(stupid|idiot|useless|hate|angry)/)) {
      setCurrentEmotion('angry');
    }
    
    try {
      // Add user message to chat
      const userMessage = { text: userInput, sender: 'user' };
      setMessages(prev => [...prev, userMessage]);

      // Extract name if not already set
      if (!userName && (userInput.toLowerCase().includes('my name is') || 
                         userInput.toLowerCase().includes('i am') || 
                         userInput.toLowerCase().includes("i'm"))) {
        const nameMatch = userInput.match(/(?:my name is|i am|i'm)\s+([^\s,.]+)/i);
        if (nameMatch && nameMatch[1]) {
          const newName = nameMatch[1];
          setUserName(newName);
          const greetingMessage = { text: `Hello ${newName}!`, sender: 'bot' };
          setMessages(prev => [...prev, greetingMessage]);
          updateEmotion(greetingMessage);
          return;
        }
      }

      let botResponse;

      ///////////////


      if (teachingMode.active) {
        // Store the answer
        try {
    const response = await axios.post('http://localhost:5000/api/learned-facts', {
    question: teachingMode.currentQuestion,
    answer: userInput
});
    
    const thankYouMessage = {
        text: `Thanks! I've learned that the answer to "${teachingMode.currentQuestion}" is "${userInput}".`,
        sender: 'bot'
    };
    setMessages(prev => [...prev, thankYouMessage]);
} catch (error) {
    console.error('Error saving knowledge:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        config: error.config
    });
    const cleanQuestion = userInput.trim().toLowerCase().replace(/\?+$/, '');
    const errorMessage = {
        text: `I couldn't save that information. Error: ${error.response?.data?.error || error.message}`,
        sender: 'bot'
    };
    setMessages(prev => [...prev, errorMessage]);
}
        setTeachingMode({ active: false, currentQuestion: '' });
        return;
    }

    // Check for known facts
    // Check for known facts
if (userInput.toLowerCase().endsWith('?')) {
    const cleanQuestion = userInput.toLowerCase().trim().replace(/\?+$/, '');
    console.log('Frontend clean question:', cleanQuestion);
    
    try {
        const response = await axios.get('http://localhost:5000/api/learned-facts', {
    params: { question: cleanQuestion }
});
        
        console.log('Backend response:', response.data);
        
        if (response.data?.answer) {
            const answerMessage = {
                text: `The answer is: ${response.data.answer}`,
                sender: 'bot'
            };
            setMessages(prev => [...prev, answerMessage]);
            return;
        }
    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            config: error.config
        });
    }

    // Only proceed to teaching mode if no answer was found
    const teachMeMessage = {
        text: "I don't know the answer to that. Can you teach me? Please provide the answer.",
        sender: 'bot'
    };
    setMessages(prev => [...prev, teachMeMessage]);
    setTeachingMode({
        active: true,
        currentQuestion: userInput
    });
    return;
}


      // Example: Inside your chat component

      // Handle small talk first
      const smallTalkResponse = handleSmallTalk(userInput);
      if (smallTalkResponse) {
        botResponse = { text: smallTalkResponse, sender: 'bot' };
        setMessages(prev => [...prev, botResponse]);
        updateEmotion(botResponse);
        return;
      }

      // Handle symptom description
      if (userInput.toLowerCase().match(/(symptom|pain|feel|hurt|ache)/)) {
        const symptomResponse = await handleSymptomCheck(userInput);
        botResponse = { text: symptomResponse, sender: 'bot' };
        setMessages(prev => [...prev, botResponse]);
        updateEmotion(botResponse);
        return;
      }

      // Handle available doctors query
       if (userInput.toLowerCase().includes('available doctors') || 
          userInput.toLowerCase().includes('doctors available')) {
        await handleAvailableDoctorsQuery();
        return;
      } 
      if (userInput.toLowerCase().includes('all doctors') || 
          userInput.toLowerCase().includes('all doctors available')) {
        await showAllDoctors();
        return;
      } 


      // Handle appointment recall
      if (userInput.toLowerCase().includes('when is my appointment') || 
          userInput.toLowerCase().includes('my appointment details') ||
          userInput.toLowerCase().includes('do i have an appointment')) {
        await handleAppointmentRecall();
        return;
      }

      // Handle goodbye
      if (userInput.toLowerCase().includes('bye') || userInput.toLowerCase().includes('goodbye')) {
        const goodbyeMessage = userName 
          ? `Goodbye, ${userName}! Have a great day.` 
          : 'Goodbye! Have a great day.';
        botResponse = { text: goodbyeMessage, sender: 'bot' };
        setMessages(prev => [...prev, botResponse]);
        updateEmotion(botResponse);
        return;
      }

      // Handle doctor availability queries
      const doctorAvailabilityMatch = userInput.match(
  /(?:is\s+)?(?:dr\.?|doctor)?\s*(\w+)\s+(?:available|free)\s*(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?/i
);

if (doctorAvailabilityMatch) {
  const doctorName = doctorAvailabilityMatch[1];
  const day = doctorAvailabilityMatch[2]?.toLowerCase() || 'today';
  await handleDoctorAvailabilityQuery(doctorName, day);
  return;
}
      // Handle best specialist queries
      if (userInput.toLowerCase().includes('best') && userInput.toLowerCase().match(/(neurologist|cardiologist|pediatrician|orthopedic)/i)) {
        const specialtyMatch = userInput.match(/(neurologist|cardiologist|pediatrician|orthopedic)/i);
        if (specialtyMatch) {
          await handleBestSpecialistQuery(specialtyMatch[0]);
        }
        return;
      }

      // Handle reminder requests
      const reminderMatch = userInput.match(/remind me to (.*) at (\d{1,2}:\d{2}\s?(am|pm)?)/i);
      if (reminderMatch) {
        const reminderMessage = reminderMatch[1];
        let reminderTime = reminderMatch[2];
        const period = reminderMatch[3] || '';
        
        // Convert to 24-hour format if needed
        if (period) {
          const [hours, minutes] = reminderTime.split(':');
          let hourInt = parseInt(hours);
          if (period.toLowerCase() === 'pm' && hourInt < 12) hourInt += 12;
          if (period.toLowerCase() === 'am' && hourInt === 12) hourInt = 0;
          reminderTime = `${hourInt}:${minutes}`;
        }
        
        setReminders(prev => [...prev, { message: reminderMessage, time: reminderTime }]);
        botResponse = { text: `I'll remind you to ${reminderMessage} at ${reminderTime}.`, sender: 'bot' };
        setMessages(prev => [...prev, botResponse]);
        updateEmotion(botResponse);
        return;
      }

      // Original feature handling
      if (userInput.toLowerCase().includes('appointment') || userInput.toLowerCase().includes('book') || userInput.toLowerCase().includes('schedule')) {
        setActiveFeature('appointment');
        botResponse = { text: 'Let me help you with appointment booking. Please provide the details.', sender: 'bot' };
        setIrrelevantCount(0);
      } 
      else if (userInput.toLowerCase().includes('doctor') || userInput.toLowerCase().includes('find') || userInput.toLowerCase().includes('specialist')) {
        const response = await axios.get('http://localhost:5000/api/doctors');
        let doctorList = "Our specialist doctors:\n";
        response.data.forEach(doctor => {
          doctorList += `\n- ${doctor.name} (${doctor.specialization})`;
        });
        doctorList += "\n\nYou can ask about a specific doctor's availability or say 'available doctors' to see who's working today.";
        botResponse = { text: doctorList, sender: 'bot' };
        setIrrelevantCount(0);
      }
      else if (userInput.toLowerCase().includes('hour') || userInput.toLowerCase().includes('time') || userInput.toLowerCase().includes('open')) {
        const response = await axios.get('http://localhost:5000/api/faqs?category=general');
        botResponse = { text: response.data[0].answer, sender: 'bot' };
        setIrrelevantCount(0);
      }
       else if (userInput.toLowerCase().includes('emergency') || userInput.toLowerCase().includes('emergency room')) {
        const response = await axios.get('http://localhost:5000/api/faqs?category=navigation');
        botResponse = { text: response.data[0].answer, sender: 'bot' };
        setIrrelevantCount(0);
      }
      else if (userInput.toLowerCase().includes('bill') || userInput.toLowerCase().includes('payment') || userInput.toLowerCase().includes('insurance')) {
        const response = await axios.get('http://localhost:5000/api/faqs?category=billing');
        botResponse = { text: response.data[0].answer, sender: 'bot' };
        setIrrelevantCount(0);
      }
      
      else {
        const irrelevantKeywords = ['sports', 'movie', 'music', 'weather', 'joke', 'game'];
        const isIrrelevant = irrelevantKeywords.some(keyword => userInput.toLowerCase().includes(keyword));
        
        if (isIrrelevant) {
          setIrrelevantCount(prev => prev + 1);
          
          if (irrelevantCount >= 2) {
            botResponse = {
              sender: 'bot',
              text: (
                <>
                  <p>Ask proper questions!</p>
                  <img src={agnryGif} alt="Angry Bot" style={{ height: '70px', width: '70px' }} />
                </>
              )
            };
            setIrrelevantCount(0);
            setCurrentEmotion('angry');
          } else {
            const response = await axios.get('http://localhost:5000/api/angry-response');
            botResponse = { text: response.data.response, sender: 'bot' };
            setCurrentEmotion('angry');
          }
        } else {
          botResponse = { text: 'i am here to help with edisco ', sender: 'bot' };
          setIrrelevantCount(0);
        }
      }

      // Save chat history to database
      await axios.post('http://localhost:5000/api/chat-history', {
        user_input: userInput,
        bot_response: botResponse.text
      });

      // Add bot response to chat and update emotion
      setMessages(prev => [...prev, botResponse]);
      updateEmotion(botResponse);

    } catch (error) {
      console.error('Error handling message:', error);
      const errorMessage = { 
        text: (
          <>
            <p>Ask propper Quetions!!</p>
            <img src={agnryGif} alt="Error" style={{ height: '70px', width: '70px' }} />
          </>
        ),
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorMessage]);
      setCurrentEmotion('angry');
    } finally {
      setIsLoading(false);
      isProcessing.current = false;
    }
  };

  // Doctor availability query handler
const handleAvailableDoctorsQuery = async () => {
  const fallbackMessage = { text: "", sender: 'bot' };

  try {
    // Try to get available doctors first
    const response = await axios.get('http://localhost:5000/api/doctors/availability', {
      params: { day: 'today' }
    });
    
    if (response.data.length === 0 || !response.data.some(doctors => doctors.isAvailable)) {
      // No available doctors, show all doctors
      return await showAllDoctors("No doctors are available today. Here are all our doctors:");
    }

    // Build available doctors message
    let message = "Here are today's available doctors:\n\n";
    response.data.forEach(doctors => {
      if (doctors.isAvailable) {
        message += `👨‍⚕️ ${doctors.name}\n`;
        message += `🏥 Specialty: ${doctors.specialization}\n`;
        message += `⏰ Available times: ${doctors.available_times}\n`;
      }
    });
    
    message += "To book an appointment, say 'Book' or click the appointment button.";
    sendBotMessage(message);
    
  } catch (error) {
    console.error('Error fetching available doctors:', error);
    await showAllDoctors("I'm having trouble checking doctor availability. Here are all our doctors:");
  }
};

// Helper functions
const showAllDoctors = async (introMessage) => {
  try {
    const response = await axios.get('http://localhost:5000/api/doctors');
    let message = introMessage + "\n\n";
    
    response.data.forEach(doctors => {
      message += `👨‍⚕️ ${doctors.name}\n`;
      message += `🏥 ${doctors.specialization}\n`;
      message += `📅 Available days: ${doctors.available_days}\n`;
      if (doctors.available_times) {
        message += `⏰ Usually available at: ${doctors.available_times}\n`;
      }
      message += `\n`;
    });
    
    sendBotMessage(message);
  } catch (error) {
    console.error('Error fetching all doctors:', error);
    sendBotMessage("I'm unable to retrieve the doctor list at the moment. Please try again later.");
  }
};

const sendBotMessage = (text) => {
  const botMessage = { text, sender: 'bot' };
  setMessages(prev => [...prev, botMessage]);
  updateEmotion(botMessage);
};

  // Doctor availability query handler
  const handleDoctorAvailabilityQuery = async (doctorName, day = 'today') => {
    try {
      const response = await axios.get('http://localhost:5000/api/doctors/availability', {
        params: { name: doctorName, day }
      });

      if (response.data.length === 0) {
        const notFoundMessage = { 
          text: `Sorry, I couldn't find ${doctorName}. Would you like to see all doctors?`, 
          sender: 'bot' 
        };
        setMessages(prev => [...prev, notFoundMessage]);
        updateEmotion(notFoundMessage);
        return;
      }

      const doctor = response.data[0];
      let message = `${doctor.name} (${doctor.specialization}) is `;
      message += doctor.isAvailable ? 'available' : 'not available';
      message += ` on ${day}.`;
      
      if (doctor.isAvailable) {
        // Handle both array and string formats for availableTimes
        const times = Array.isArray(doctor.availableTimes) 
          ? doctor.availableTimes.join(', ')
          : doctor.available_times || 'Not specified';
          
        message += `\nAvailable times: ${times}.`;
        
        setAppointmentData(prev => ({
          ...prev,
          doctorId: doctor.id,
          doctorName: doctor.name
        }));
      }

      const botMessage = { text: message, sender: 'bot' };
      setMessages(prev => [...prev, botMessage]);
      updateEmotion(botMessage);
    } catch (error) {
      console.error('Error checking doctor availability:', error);
      const errorMessage = { 
        text: 'Sorry, I encountered an error. You can try asking "Show all doctors" or try again later.', 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorMessage]);
      updateEmotion({ text: errorMessage.text, sender: 'bot', emotion: 'angry' });
    }
};

  // Best specialist query handler
  const handleBestSpecialistQuery = async (specialty) => {
    try {
      const response = await axios.get('http://localhost:5000/api/doctors', {
        params: { specialization: specialty }
      });
      
      if (response.data.length > 0) {
        const specialists = response.data;
        const bestDoctor = specialists[0];
        let responseMessage = `Our ${specialty} is ${bestDoctor.name}\n`;
        responseMessage += `Available: ${bestDoctor.available_days} at ${bestDoctor.available_times}\n`;
       
        
        const botMessage = { text: responseMessage, sender: 'bot' };
        setMessages(prev => [...prev, botMessage]);
        updateEmotion(botMessage);
        
        setAppointmentData(prev => ({
          ...prev,
          doctorId: bestDoctor.id,
          doctorName: bestDoctor.name
        }));
      } else {
        const notFoundMessage = { 
          text: `We currently don't have any ${specialty}s on our team.`, 
          sender: 'bot' 
        };
        setMessages(prev => [...prev, notFoundMessage]);
        updateEmotion(notFoundMessage);
      }
    } catch (error) {
      console.error('Error finding specialist:', error);
      const errorMessage = { 
        text: "Sorry, I couldn't find specialist information. Please try again later.", 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorMessage]);
      setCurrentEmotion('angry');
    }
  };

  // Quick action handler
  const handleQuickAction = (action) => {
    let message;
    switch (action) {
      case 'call':
        message = { text: 'Calling hospital reception at +94 123-4567', sender: 'bot' };
        break;
      case 'email':
        message = { text: 'You can email our doctors at doctors@mediscohospital.com', sender: 'bot' };
        break;
       case 'directions':
        message = { text: 'Medisco Hospital is located at 123 Health Street, Medical City. Here are directions: https://maps.app.goo.gl/MwBnmwnMEiEzxVKu9', sender: 'bot' };
        break; 
      default:
        return;
    }
    setMessages(prev => [...prev, message]);
    updateEmotion(message);
  };

  // Appointment availability check
  const handleCheckAvailability = async () => {
    if (!appointmentData.doctorId || !appointmentData.date) {
      const errorMessage = { 
        text: 'Please select both a doctor and a date first', 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorMessage]);
      setCurrentEmotion('angry');
      return;
    }
    
    try {
      const formattedDate = new Date(appointmentData.date).toISOString().split('T')[0];
      
      const response = await axios.get('http://localhost:5000/api/appointments/availability', {
        params: {
          doctorId: appointmentData.doctorId,
          date: formattedDate
        }
      });
      
      const doctor = doctors.find(d => d.id.toString() === appointmentData.doctorId.toString());
      
      if (!doctor) {
        const notFoundMessage = { 
          text: 'Doctor not found. Please try again.', 
          sender: 'bot' 
        };
        setMessages(prev => [...prev, notFoundMessage]);
        setCurrentEmotion('angry');
        return;
      }
      
      const allTimes = doctor.available_times.split(',').map(time => time.trim());
      const bookedTimes = response.data.bookedTimes || [];
      const available = allTimes.filter(time => !bookedTimes.includes(time));
      
      setAvailableTimes(available);
      const availabilityMessage = { 
        text: `Available times for ${appointmentData.date}: ${available.join(', ') || 'No available times'}`, 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, availabilityMessage]);
      updateEmotion(availabilityMessage);
      
      if (available.length > 0) {
        setAppointmentData(prev => ({...prev, time: available[0]}));
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      const errorMessage = { 
        text: 'Error checking availability. Please try again.', 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorMessage]);
      setCurrentEmotion('angry');
    }
  };

  // Appointment submission
  const handleAppointmentSubmit = async () => {
    if (!appointmentData.name || !appointmentData.email || !appointmentData.phone || 
        !appointmentData.doctorId || !appointmentData.date || !appointmentData.time) {
      const errorMessage = { 
        text: 'Please fill in all fields before booking', 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorMessage]);
      setCurrentEmotion('angry');
      return;
    }

    try {
      const formattedDate = new Date(appointmentData.date).toISOString().split('T')[0];
      
      const appointmentPayload = {
        patient_name: appointmentData.name,
        patient_email: appointmentData.email,
        patient_phone: appointmentData.phone,
        doctor_id: appointmentData.doctorId,
        appointment_date: formattedDate,
        appointment_time: appointmentData.time
      };

      const response = await axios.post('http://localhost:5000/api/appointments', appointmentPayload);
      
      const successMessage = { 
        text: `Appointment booked successfully for ${formattedDate} at ${appointmentData.time} with ${
          doctors.find(d => d.id.toString() === appointmentData.doctorId.toString())?.name || ''
        }`, 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, successMessage]);
      updateEmotion(successMessage);

      if (!userName) {
        setUserName(appointmentData.name);
      }
      
      setActiveFeature(null);
      setAppointmentData({
        name: '',
        email: '',
        phone: '',
        doctorId: '',
        date: '',
        time: ''
      });
      setAvailableTimes([]);
    } catch (error) {
      console.error('Error booking appointment:', error.response?.data || error.message);
      const errorMessage = { 
        text: `Failed to book appointment: ${error.response?.data?.error || error.message || 'Please try again'}`, 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorMessage]);
      setCurrentEmotion('angry');
    }
  };

  // Appointment recall handler
  const handleAppointmentRecall = async () => {
    try {
      if (!appointmentData.email && !userName) {
        const errorMessage = { 
          text: "I don't have your information.", 
          sender: 'bot' 
        };
        setMessages(prev => [...prev, errorMessage]);
        setCurrentEmotion('neutral');
        return;
      }

      const response = await axios.get('http://localhost:5000/api/appointments/latest', {
        params: {
          email: appointmentData.email,
          name: userName
        }
      });

      if (response.data) {
        const appointment = response.data;
        const appointmentMessage = { 
          text: `Your appointment is with ${appointment.doctor_name} on ${appointment.appointment_date} at ${appointment.appointment_time}.`, 
          sender: 'bot' 
        };
        setMessages(prev => [...prev, appointmentMessage]);
        updateEmotion(appointmentMessage);
      } else {
        const notFoundMessage = { 
          text: "I couldn't find any upcoming appointments for you. Would you like to book one?", 
          sender: 'bot' 
        };
        setMessages(prev => [...prev, notFoundMessage]);
        updateEmotion(notFoundMessage);
      }
    } catch (error) {
      console.error('Error fetching appointment:', error);
      const errorMessage = { 
        text: "Sorry, I couldn't retrieve your appointment details. Please try again later.", 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorMessage]);
      setCurrentEmotion('angry');
    }
  };

  // Feature rendering
  const renderFeature = () => {
    switch (activeFeature) {
      case 'appointment':
        return (
          <div className="feature-form">
            <h3>Book Appointment</h3>
            <input
              type="text"
              placeholder="Your Name"
              value={appointmentData.name}
              onChange={(e) => setAppointmentData({...appointmentData, name: e.target.value})}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={appointmentData.email}
              onChange={(e) => setAppointmentData({...appointmentData, email: e.target.value})}
              required
            />
            <input
              type="tel"
              placeholder="Phone"
              value={appointmentData.phone}
              onChange={(e) => setAppointmentData({...appointmentData, phone: e.target.value})}
              required
            />
            <select
              value={appointmentData.doctorId}
              onChange={(e) => setAppointmentData({...appointmentData, doctorId: e.target.value})}
              required
            >
              <option value="">Select Doctor</option>
              {doctors.map(doctor => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name} - {doctor.specialization}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={appointmentData.date}
              onChange={(e) => setAppointmentData({...appointmentData, date: e.target.value})}
              min={new Date().toISOString().split('T')[0]}
              required
            />
            <button onClick={handleCheckAvailability}>Check Availability</button>
            
            {availableTimes.length > 0 && (
              <select
                value={appointmentData.time}
                onChange={(e) => setAppointmentData({...appointmentData, time: e.target.value})}
                required
              >
                <option value="">Select Time</option>
                {availableTimes.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            )}
            
            <div className="form-buttons">
              <button 
                onClick={handleAppointmentSubmit}
                disabled={!appointmentData.name || !appointmentData.email || !appointmentData.phone || 
                         !appointmentData.doctorId || !appointmentData.date || !appointmentData.time}
              >
                Book
              </button>
              <button onClick={() => setActiveFeature(null)}>Cancel</button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
      <div >
                <h1>Medisco Hospital Assistant  </h1>
      </div>
      
    </header>

      <div className="avatar-container">
        <img 
          src={emotionFaces[currentEmotion]} 
          alt={`${currentEmotion} face`} 
          className={`avatar ${currentEmotion}`}
        />
      </div>
      
      <div className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message-container ${message.sender}`}>
              {message.sender === 'bot' && <SmartToyIcon className="message-icon" />}
              <div className={`message ${message.sender}`}>
                {typeof message.text === 'string' ? (
                  message.text.split('\n').map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))
                ) : (
                  message.text
                )}
              </div>
              {message.sender === 'user' && <PersonIcon className="message-icon" />}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {activeFeature ? (
          renderFeature()
        ) : (
          <div className="input-area">
            <div className="quick-actions">
              <button onClick={() => setActiveFeature('appointment')} title="Book Appointment">
                <EventSeatIcon/>
              </button>
              <button onClick={() => {
                const doctorList = "Our specialist doctors:\n" + 
                  doctors.map(doctor => `\n- ${doctor.name} (${doctor.specialization})`).join('');
                setMessages(prev => [...prev, 
                  { text: doctorList, sender: 'bot' }
                ]);
              }} title="Find a Doctor">
                <PersonSearchIcon />
              </button>
              <button onClick={() => {
                setMessages(prev => [...prev, 
                  { text: "Please describe your symptoms (e.g., 'I have a headache and fever')", sender: 'bot' }
                ]);
              }} title="Symptom Checker">
                <LocalHospitalIcon />
              </button>
              <button onClick={() => handleQuickAction('call')} title="Call Reception">
                <PhoneIcon />
              </button>
              <button onClick={() => handleQuickAction('email')} title="Email Doctor">
                <EmailIcon />
              </button>
              <button onClick={() => handleQuickAction('directions')} title="Get Directions">
                <LocationOnIcon />
              </button>
              <button onClick={() => {
                setMessages(prev => [...prev, 
                  { text: 'Our general visiting hours are from 8:00 AM to 8:00 PM daily.', sender: 'bot' }
                ]);
              }} title="Visiting Hours">
                <ScheduleIcon />
              </button>
            </div>
            
            <div className="message-input">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button onClick={handleListen} className={isListening ? 'listening' : ''}>
                {isListening ? <MicOffIcon /> : <MicIcon />}
              </button>
              <button onClick={handleSendMessage}>
                <SendIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;