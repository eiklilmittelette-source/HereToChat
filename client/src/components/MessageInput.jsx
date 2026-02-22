import React, { useState, useRef } from 'react';
import { apiUrl } from '../api';

const EMOJI_CATEGORIES = {
  '😀 Smileys': [
    '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉',
    '😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲',
    '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔',
    '😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌',
    '😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵',
    '🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐',
    '😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹',
    '😦','😧','😨','😰','😥','😢','😭','😱','😖','😣',
    '😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈',
    '👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾',
    '🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
  ],
  '👋 Gestes': [
    '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌',
    '🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉',
    '👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛',
    '🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅',
    '🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠',
    '🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦',
  ],
  '❤️ Coeurs': [
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
    '❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝',
    '💟','♥️','💋','💌','💐','🌹','🥀','🫶',
  ],
  '🐱 Animaux': [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨',
    '🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒',
    '🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗',
    '🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰',
    '🐢','🐍','🦎','🦂','🦀','🦑','🐙','🐠','🐟','🐬',
    '🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘',
    '🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄',
  ],
  '🍕 Nourriture': [
    '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐',
    '🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑',
    '🫛','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🧄','🧅',
    '🥔','🍠','🫘','🥐','🥖','🍞','🥨','🧀','🥚','🍳',
    '🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔',
    '🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗',
    '🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙',
    '🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦',
    '🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩',
    '🍪','🌰','🥜','🍯','☕','🫖','🍵','🧃','🥤','🧋',
    '🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾',
  ],
  '⚽ Sport': [
    '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱',
    '🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳',
    '🪁','🛝','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼',
    '🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤸','🤼',
    '🤺','⛹️','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣',
    '🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️',
  ],
  '🚗 Voyage': [
    '🚗','🚕','🚙','🏎️','🚓','🚑','🚒','🚐','🛻','🚚',
    '🚛','🚜','🏍️','🛵','🚲','🛴','🛺','🚔','🚍','🚘',
    '✈️','🛫','🛬','🛩️','🚀','🛸','🚁','🛶','⛵','🚤',
    '🛳️','⛴️','🚢','🗼','🗽','🏰','🏯','🎡','🎢','🎠',
    '⛲','⛱️','🏖️','🏝️','🏔️','⛰️','🗻','🌋','🏕️','🛤️',
  ],
  '🎵 Musique': [
    '🎵','🎶','🎼','🎤','🎧','🎷','🎸','🎹','🥁','🪘',
    '🎺','🪗','🎻','🪕','🎬','🎭','🎨','🎪','🎯','🎲',
    '🎮','🕹️','🎰','🧩',
  ],
  '🌍 Nature': [
    '🌍','🌎','🌏','🌐','🗺️','🌞','🌝','🌛','🌜','🌚',
    '🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘','☀️','🌤️',
    '⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️',
    '⛄','🌬️','💨','🌪️','🌈','🌫️','💧','💦','🌊','🔥',
    '⭐','🌟','✨','💫','☄️','🌸','💮','🌹','🥀','🌺',
    '🌻','🌼','🌷','🪷','🌱','🪴','🌲','🌳','🌴','🌵',
    '🍀','☘️','🍁','🍂','🍃','🪹','🪺','🍄','🌾','🪨',
  ],
  '🎉 Objets': [
    '🎉','🎊','🎈','🎁','🎀','🎗️','🏷️','💡','🔦','🕯️',
    '🪔','📱','💻','⌨️','🖥️','🖨️','📷','📸','📹','🎥',
    '📞','☎️','📺','📻','🎙️','⏰','⏳','🔔','🔕','📢',
    '📣','💰','💵','💴','💶','💷','💎','⚖️','🔧','🔨',
    '🪛','🔩','⚙️','🧲','🔬','🔭','📡','💉','🩸','💊',
    '🩹','🩺','🚪','🪞','🛏️','🪑','🚽','🧴','🧹','🧺',
    '📦','📫','📬','📮','🗳️','✏️','✒️','🖊️','📝','📚',
    '📖','🔑','🗝️','🔒','🔓','🛡️','⚔️','🏳️','🏴','🚩',
  ],
  '💯 Symboles': [
    '💯','💢','💥','💫','💦','💨','🕳️','💣','💬','💭',
    '🗯️','💤','✅','❌','❓','❗','‼️','⁉️','⚠️','🚫',
    '🔞','♻️','✳️','❇️','🔆','🔅','🔱','⚜️','🔰','♾️',
    '🆗','🆕','🆒','🆙','🆓','🔝','🔜','🔛','🔚','🏧',
    '♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓',
  ],
};

export default function MessageInput({ onSend, onSendFile, onTyping, onStopTyping, disabled, token, replyTo, onCancelReply }) {
  const [text, setText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const typingTimeout = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const recordInterval = useRef(null);

  function handleChange(e) {
    setText(e.target.value);
    onTyping();
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onStopTyping(), 1000);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
    onStopTyping();
    setShowEmojis(false);
  }

  function addEmoji(emoji) {
    setText(prev => prev + emoji);
    inputRef.current?.focus();
  }

  // Voice recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunks.current = [];
      mr.ondataavailable = (e) => audioChunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result;
          try {
            const res = await fetch(apiUrl('/api/upload'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ fileData: base64, fileName: 'voice.webm', fileType: 'voice' })
            });
            const data = await res.json();
            if (res.ok) onSendFile('voice', data.fileUrl, 'Message vocal');
          } catch {}
        };
        reader.readAsDataURL(blob);
      };
      mr.start();
      mediaRecorder.current = mr;
      setRecording(true);
      setRecordTime(0);
      recordInterval.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch {
      // Microphone access denied
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    setRecording(false);
    clearInterval(recordInterval.current);
  }

  function cancelRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.ondataavailable = null;
      mediaRecorder.current.onstop = null;
      mediaRecorder.current.stop();
      mediaRecorder.current.stream?.getTracks().forEach(t => t.stop());
    }
    audioChunks.current = [];
    setRecording(false);
    clearInterval(recordInterval.current);
  }

  // File attachment
  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB max
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch(apiUrl('/api/upload'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileData: reader.result, fileName: file.name })
        });
        const data = await res.json();
        if (res.ok) {
          const isImage = file.type.startsWith('image/');
          onSendFile(isImage ? 'image' : 'file', data.fileUrl, file.name);
        }
      } catch {}
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }

  const categories = Object.keys(EMOJI_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState(categories[0]);

  if (recording) {
    return (
      <div className="message-input-wrapper">
        <div className="message-input recording-bar">
          <button type="button" className="cancel-record-btn" onClick={cancelRecording}>✕</button>
          <div className="record-indicator">
            <span className="record-dot"></span>
            <span className="record-time">{formatTime(recordTime)}</span>
          </div>
          <button type="button" className="send-record-btn" onClick={stopRecording}>➤</button>
        </div>
      </div>
    );
  }

  return (
    <div className="message-input-wrapper">
      {replyTo && (
        <div className="reply-bar">
          <div className="reply-bar-content">
            <div className="reply-bar-name">{replyTo.sender_full_name || replyTo.sender_name || 'Message'}</div>
            <div className="reply-bar-text">{replyTo.content || (replyTo.type === 'voice' ? 'Message vocal' : replyTo.file_name || 'Fichier')}</div>
          </div>
          <button className="reply-bar-close" onClick={onCancelReply} type="button">✕</button>
        </div>
      )}
      {showEmojis && (
        <div className="emoji-picker">
          <div className="emoji-tabs">
            {categories.map(cat => (
              <button
                key={cat}
                className={`emoji-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
                type="button"
              >
                {cat.split(' ')[0]}
              </button>
            ))}
          </div>
          <div className="emoji-grid">
            {EMOJI_CATEGORIES[activeCategory].map((emoji, i) => (
              <button key={i} className="emoji-btn" onClick={() => addEmoji(emoji)} type="button">
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      <form className="message-input" onSubmit={handleSubmit}>
        <button
          type="button"
          className="emoji-toggle"
          onClick={() => setShowEmojis(!showEmojis)}
        >
          😊
        </button>
        <button type="button" className="attach-btn" onClick={() => fileRef.current?.click()}>
          📎
        </button>
        <input
          ref={fileRef}
          type="file"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept="image/*,.pdf,.doc,.docx,.txt,.zip,.mp3,.mp4"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Écrire un message..."
          value={text}
          onChange={handleChange}
          disabled={disabled}
          autoFocus
        />
        {text.trim() ? (
          <button type="submit" disabled={disabled}>➤</button>
        ) : (
          <button type="button" className="voice-btn" onClick={startRecording} disabled={disabled}>🎤</button>
        )}
      </form>
    </div>
  );
}
