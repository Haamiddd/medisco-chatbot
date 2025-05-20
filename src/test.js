import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SendIcon from '@mui/icons-material/Send';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import HelpIcon from '@mui/icons-material/Help';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import MapIcon from '@mui/icons-material/Map';
import ChatIcon from '@mui/icons-material/Chat';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import agnryGif from '../src/angry.gif';
import './App.scss';

if (!SpeechRecognition.browserSupportsSpeechRecognition()) {
  console.log('Your browser does not support speech recognition');
}

const App = () => {
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
  const messagesEndRef = useRef(null);

  const commands = [
    {
      command: 'reset',
      callback: () => resetTranscript()
    }
  ];

  const { transcript, resetTranscript } = useSpeechRecognition({ commands });

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

  useEffect(() => {
    // Initial greeting
    setMessages([{ text: 'Hello! Welcome to Medisco Hospital. How can I assist you today?', sender: 'bot' }]);
    
    // Fetch initial data
    fetchDoctors();
    fetchDepartments();
    checkAppointmentReminders();
    
    // Set up interval for reminders
    const reminderInterval = setInterval(() => {
      checkReminders();
    }, 60000); // Check every minute

    return () => clearInterval(reminderInterval);
  }, []);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const checkAppointmentReminders = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/appointments/reminders');
      if (response.data.length > 0) {
        const reminder = response.data[0]; // Get the first upcoming appointment
        setMessages(prev => [...prev, 
          { text: `Hi ${reminder.patient_name}! Friendly reminder: Your appointment with Dr. ${reminder.doctor_name} is on ${reminder.appointment_date} at ${reminder.appointment_time}.`, sender: 'bot' }
        ]);
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
        setMessages(prev => [...prev, 
          { text: `⏰ Reminder: ${reminder.message}`, sender: 'bot' }
        ]);
      }
    });
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to chat
    const userMessage = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    
    // Extract name if not already set
    if (!userName && (input.toLowerCase().includes('my name is') || input.toLowerCase().includes('i am'))) {
      const nameMatch = input.match(/(?:my name is|i am|i'm)\s+([^\s,.]+)/i);
      if (nameMatch && nameMatch[1]) {
        setUserName(nameMatch[1]);
      }
    }
    
    setInput('');

    // Handle small talk and common phrases first
    const smallTalkResponse = handleSmallTalk(input);
    if (smallTalkResponse) {
      setMessages(prev => [...prev, { text: smallTalkResponse, sender: 'bot' }]);
      return;
    }

    // Handle goodbye
    if (input.toLowerCase().includes('bye') || input.toLowerCase().includes('goodbye')) {
      const goodbyeMessage = userName 
        ? `Goodbye, ${userName}! Have a great day. Feel free to come back if you need anything.` 
        : 'Goodbye! Have a great day. Feel free to come back if you need anything.';
      setMessages(prev => [...prev, { text: goodbyeMessage, sender: 'bot' }]);
      return;
    }

    // Handle doctor availability queries
    const doctorAvailabilityMatch = input.match(/(is\s+dr\.?\s+(\w+)\s+available\s+(today|tomorrow))/i);
    if (doctorAvailabilityMatch) {
      const doctorName = doctorAvailabilityMatch[2];
      const day = doctorAvailabilityMatch[3];
      handleDoctorAvailabilityQuery(doctorName, day);
      return;
    }

    // Handle best specialist queries
    if (input.toLowerCase().includes('best') && input.toLowerCase().match(/(neurologist|cardiologist|pediatrician|orthopedic)/i)) {
      const specialtyMatch = input.match(/(neurologist|cardiologist|pediatrician|orthopedic)/i);
      if (specialtyMatch) {
        handleBestSpecialistQuery(specialtyMatch[0]);
      }
      return;
    }

    // Handle reminder requests
    const reminderMatch = input.match(/remind me to (.*) at (\d{1,2}:\d{2}\s?(am|pm)?)/i);
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
      setMessages(prev => [...prev, 
        { text: `I'll remind you to ${reminderMessage} at ${reminderTime}.`, sender: 'bot' }
      ]);
      return;
    }

    // Original feature handling
    let botResponse;
    
    if (input.toLowerCase().includes('appointment') || input.toLowerCase().includes('book') || input.toLowerCase().includes('schedule')) {
      setActiveFeature('appointment');
      botResponse = { text: 'Let me help you with appointment booking. Please provide the details.', sender: 'bot' };
      setIrrelevantCount(0);
    } 
    else if (input.toLowerCase().includes('doctor') || input.toLowerCase().includes('find') || input.toLowerCase().includes('specialist')) {
      setActiveFeature('doctor');
      botResponse = { text: 'Here are our specialists. Who would you like to see?', sender: 'bot' };
      setIrrelevantCount(0);
    }
    else if (input.toLowerCase().includes('symptom') || input.toLowerCase().includes('pain') || input.toLowerCase().includes('feel')) {
      setActiveFeature('symptom');
      botResponse = { text: 'Please describe your symptoms so I can advise you.', sender: 'bot' };
      setIrrelevantCount(0);
    }
    else if (input.toLowerCase().includes('hour') || input.toLowerCase().includes('time') || input.toLowerCase().includes('open')) {
      const response = await axios.get('http://localhost:5000/api/faqs?category=general');
      botResponse = { text: response.data[0].answer, sender: 'bot' };
      setIrrelevantCount(0);
    }
    else if (input.toLowerCase().includes('bill') || input.toLowerCase().includes('payment') || input.toLowerCase().includes('insurance')) {
      const response = await axios.get('http://localhost:5000/api/faqs?category=billing');
      botResponse = { text: response.data[0].answer, sender: 'bot' };
      setIrrelevantCount(0);
    }
    else if (input.toLowerCase().includes('emergency') || input.toLowerCase().includes('location') || input.toLowerCase().includes('where')) {
      const response = await axios.get('http://localhost:5000/api/faqs?category=navigation');
      botResponse = { text: response.data[0].answer, sender: 'bot' };
      setIrrelevantCount(0);
    }
    else {
      const irrelevantKeywords = ['sports', 'movie', 'music', 'weather', 'joke', 'game'];
      const isIrrelevant = irrelevantKeywords.some(keyword => input.toLowerCase().includes(keyword));
      
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
        } else {
          const response = await axios.get('http://localhost:5000/api/angry-response');
          botResponse = { text: response.data.response, sender: 'bot' };
        }
      } else {
        botResponse = { text: 'I can help with appointments, doctor information, symptoms checking, and general hospital information. What do you need?', sender: 'bot' };
        setIrrelevantCount(0);
      }
    }

    // Save chat history to database
    try {
      await axios.post('http://localhost:5000/api/chat-history', {
        user_input: input,
        bot_response: botResponse.text
      });
    } catch (error) {
      console.error('Error saving chat history:', error);
    }

    // Add bot response to chat
    if (botResponse) {
      setTimeout(() => {
        setMessages(prev => [...prev, botResponse]);
      }, 500);
    }
  };

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
    
    if (lowerInput.includes('hi') || lowerInput.includes('hello') || lowerInput.includes('hey')) {
      return userName ? `Hello again, ${userName}! How can I help you today?` : "Hello there! How can I assist you today?";
    }
    
    return null;
  };

  const handleDoctorAvailabilityQuery = async (doctorName, day) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/doctors/availability?name=${doctorName}&day=${day}`);
      const doctor = response.data;
      
      if (doctor) {
        let availabilityMessage = `Dr. ${doctor.name} is ${doctor.available_days.includes(day) ? 'available' : 'not available'} ${day}. `;
        availabilityMessage += `Specialty: ${doctor.specialization}. `;
        availabilityMessage += `Available times: ${doctor.available_times}.`;
        
        setMessages(prev => [...prev, { text: availabilityMessage, sender: 'bot' }]);
      } else {
        setMessages(prev => [...prev, { text: `Sorry, I couldn't find information about Dr. ${doctorName}.`, sender: 'bot' }]);
      }
    } catch (error) {
      console.error('Error checking doctor availability:', error);
      setMessages(prev => [...prev, { text: 'Sorry, I encountered an error checking availability.', sender: 'bot' }]);
    }
  };

  const handleBestSpecialistQuery = (specialty) => {
    const specialists = doctors.filter(doctor => 
      doctor.specialization.toLowerCase().includes(specialty.toLowerCase())
    ).sort((a, b) => b.rating - a.rating);
    
    if (specialists.length > 0) {
      const bestDoctor = specialists[0];
      let response = `Our top ${specialty} is Dr. ${bestDoctor.name} `;
      response += `(Rating: ${bestDoctor.rating}/5). `;
      response += `Available: ${bestDoctor.available_days} at ${bestDoctor.available_times}. `;
      response += `Would you like to book an appointment?`;
      
      setMessages(prev => [...prev, { text: response, sender: 'bot' }]);
    } else {
      setMessages(prev => [...prev, { text: `We currently don't have any ${specialty}s on our team.`, sender: 'bot' }]);
    }
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'call':
        setMessages(prev => [...prev, 
          { text: 'Calling hospital reception at +1 (555) 123-4567', sender: 'bot' }
        ]);
        // In a real app, you might use window.location.href = 'tel:+15551234567'
        break;
      case 'email':
        setMessages(prev => [...prev, 
          { text: 'You can email our doctors at doctors@mediscohospital.com', sender: 'bot' }
        ]);
        break;
      case 'directions':
        setMessages(prev => [...prev, 
          { text: 'Medisco Hospital is located at 123 Health Street, Medical City. Here are directions: https://maps.google.com/?q=Medisco+Hospital', sender: 'bot' }
        ]);
        break;
      default:
        break;
    }
  };

  // ... (keep all your existing functions like handleCheckAvailability, handleAppointmentSubmit, etc.)
  const handleCheckAvailability = async () => {
  if (!appointmentData.doctorId || !appointmentData.date) {
    setMessages(prev => [...prev, 
      { text: 'Please select both a doctor and a date first', sender: 'bot' }
    ]);
    return;
  }
  
  try {
    // Convert date to proper format (YYYY-MM-DD)
    const formattedDate = new Date(appointmentData.date).toISOString().split('T')[0];
    
    const response = await axios.get('http://localhost:5000/api/appointments/availability', {
      params: {
        doctorId: appointmentData.doctorId,
        date: formattedDate
      }
    });
    
    // Get doctor's available times
    const doctor = doctors.find(d => d.id.toString() === appointmentData.doctorId.toString());
    
    if (!doctor) {
      setMessages(prev => [...prev, 
        { text: 'Doctor not found. Please try again.', sender: 'bot' }
      ]);
      return;
    }
    
    const allTimes = doctor.available_times.split(',').map(time => time.trim());
    const bookedTimes = response.data.bookedTimes || [];
    const available = allTimes.filter(time => !bookedTimes.includes(time));
    
    setAvailableTimes(available);
    setMessages(prev => [...prev, 
      { text: `Available times for ${appointmentData.date}: ${available.join(', ') || 'No available times'}`, sender: 'bot' }
    ]);
    
    // Auto-select the first available time if there's one
    if (available.length > 0) {
      setAppointmentData(prev => ({...prev, time: available[0]}));
    }
  } catch (error) {
    console.error('Error checking availability:', error);
    setMessages(prev => [...prev, 
      { text: 'Error checking availability. Please try again.', sender: 'bot' }
    ]);
  }
};
const handleAppointmentSubmit = async () => {
  // Validate all fields
  if (!appointmentData.name || !appointmentData.email || !appointmentData.phone || 
      !appointmentData.doctorId || !appointmentData.date || !appointmentData.time) {
    setMessages(prev => [...prev, 
      { text: 'Please fill in all fields before booking', sender: 'bot' }
    ]);
    return;
  }

  try {
    // Format the date properly
    const formattedDate = new Date(appointmentData.date).toISOString().split('T')[0];
    
    // Prepare the request payload with the exact field names expected by the backend
    const appointmentPayload = {
      patient_name: appointmentData.name,
      patient_email: appointmentData.email,
      patient_phone: appointmentData.phone,
      doctor_id: appointmentData.doctorId,  // Note: backend expects doctor_id (not doctorId)
      appointment_date: formattedDate,
      appointment_time: appointmentData.time
    };

    const response = await axios.post('http://localhost:5000/api/appointments', appointmentPayload);
    
    setMessages(prev => [...prev, 
      { text: `Appointment booked successfully for ${formattedDate} at ${appointmentData.time} with Dr. ${
        doctors.find(d => d.id.toString() === appointmentData.doctorId.toString())?.name || ''
      }`, sender: 'bot' }
    ]);
    
    // Reset form
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
    setMessages(prev => [...prev, 
      { text: `Failed to book appointment: ${error.response?.data?.error || error.message || 'Please try again'}`, sender: 'bot' }
    ]);
  }
};
  const handleSymptomSubmit = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/symptom-checker', {
        symptoms: input
      });
      setMessages(prev => [...prev, 
        { text: response.data.recommendation, sender: 'bot' }
      ]);
      setActiveFeature(null);
    } catch (error) {
      console.error('Error checking symptoms:', error);
    }
  };

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
      case 'doctor':
        return (
          <div className="feature-list">
            <h3>Our Specialists</h3>
            <div className="doctor-grid">
              {doctors.map(doctor => (
                <div key={doctor.id} className="doctor-card">
                  <h4>Dr. {doctor.name}</h4>
                  <p>Specialty: {doctor.specialization}</p>
                  <p>Rating: {doctor.rating}/5</p>
                  <p>Available: {doctor.available_days} at {doctor.available_times}</p>
                  <button onClick={() => {
                    setMessages(prev => [...prev, 
                      { text: `Would you like to book an appointment with Dr. ${doctor.name}?`, sender: 'bot' }
                    ]);
                    setAppointmentData(prev => ({...prev, doctorId: doctor.id}));
                    setActiveFeature('appointment');
                  }}>
                    Book Appointment
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setActiveFeature(null)}>Back</button>
          </div>
        );
      case 'symptom':
        return (
          <div className="feature-form">
            <h3>Symptom Checker</h3>
            <textarea
              placeholder="Describe your symptoms..."
              value={input}
              onChange={handleInputChange}
            />
            <div className="form-buttons">
              <button onClick={handleSymptomSubmit}>Submit</button>
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
        <h1>Medisco Hospital Assistant</h1>
      </header>
      
      <div className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.sender}`}>
              {message.text}
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
                <ScheduleIcon />
              </button>
              <button onClick={() => setActiveFeature('doctor')} title="Find a Doctor">
                <PersonSearchIcon />
              </button>
              <button onClick={() => setActiveFeature('symptom')} title="Symptom Checker">
                <LocalHospitalIcon />
              </button>
              <button onClick={() => handleQuickAction('call')} title="Call Reception">
                <PhoneIcon />
              </button>
              <button onClick={() => handleQuickAction('email')} title="Email Doctor">
                <EmailIcon />
              </button>
              <button onClick={() => handleQuickAction('directions')} title="Get Directions">
                <MapIcon />
              </button>
              <button onClick={() => {
                setMessages(prev => [...prev, 
                  { text: 'Our general visiting hours are from 8:00 AM to 8:00 PM daily.', sender: 'bot' }
                ]);
              }} title="Visiting Hours">
                <HelpIcon />
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