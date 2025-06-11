import axios from "axios";

// Cache management
const cache = new Map();
const CACHE_DURATION = 60000; // 1 minute

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

export const fetchPages = () => {
  const cacheKey = 'pages';
  const cached = getCached(cacheKey);
  if (cached) return Promise.resolve(cached);

  return axios.get("http://localhost:8000/pages")
    .then(res => {
      const pages = res.data.pages || [];
      setCache(cacheKey, pages);
      return pages;
    });
};

export const sendMessage = (selectedPage, conversationId, newMessage) => {
  return axios.get(`http://localhost:8000/messages/${selectedPage}/${conversationId}`)
    .then(res => {
      const data = res.data.data || [];
      const recipient = data.find(msg => msg.from?.id !== selectedPage);
      const psid = recipient?.from?.id;
      if (!psid) throw new Error("ไม่พบ PSID ผู้รับ");
      return axios.post(`http://localhost:8000/send/${selectedPage}/${psid}`, {
        message: newMessage,
      });
    });
};

export const connectFacebook = () => {
  window.location.href = "http://localhost:8000/connect";
};

// 🔸 เพิ่มข้อความใหม่แบบเดี่ยว - รองรับ media
export async function saveMessageToDB({ pageId, messageSetId, messageType, content, displayOrder, mediaData, filename }) {
  const res = await fetch("http://localhost:8000/custom_message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      page_id: pageId,
      message_set_id: messageSetId,
      message_type: messageType,
      content,
      display_order: displayOrder,
      media_data: mediaData,
      filename: filename
    })
  });

  if (!res.ok) throw new Error("บันทึกข้อความไม่สำเร็จ");
  return res.json();
}

// 🔸 ดึง conversations พร้อม pagination และ cache
// 🔸 ดึง conversations พร้อม pagination และ cache
export const fetchConversations = async (pageId, limit = 50, offset = 0, useCache = true) => {
  if (!pageId) return [];

  const cacheKey = `conversations_${pageId}_${limit}_${offset}`;
  
  // ถ้าใช้ cache และมีข้อมูลใน cache
  if (useCache) {
    const cached = getCached(cacheKey);
    if (cached) {
      console.log("📦 Using cached conversations");
      return cached;
    }
  }

  try {
    const res = await axios.get(`http://localhost:8000/conversations-with-last-message/${pageId}`, {
      params: { 
        limit, 
        offset, 
        use_cache: useCache 
      }
    });

    if (res.data.error) {
      throw new Error(res.data.error);
    }

    const response = res.data;
    const conversationsData = response.conversations || [];

    const formattedConversations = conversationsData.map((conv, idx) => ({
      id: idx + 1,
      updated_time: conv.updated_time,
      created_time: conv.created_time,
      last_user_message_time: conv.last_user_message_time,
      sender_name: conv.psids[0] || "Unknown",
      conversation_id: conv.conversation_id,
      conversation_name: conv.conversation_name,
      user_name: conv.user_name,
      raw_psid: conv.raw_psid || conv.psids[0]
    }));

    // เก็บใน cache
    if (useCache) {
      setCache(cacheKey, {
        conversations: formattedConversations,
        total: response.total || formattedConversations.length,
        limit: response.limit || limit,
        offset: response.offset || offset,
        cached: response.cached || false
      });
    }

    return {
      conversations: formattedConversations,
      total: response.total || formattedConversations.length,
      limit: response.limit || limit,
      offset: response.offset || offset,
      cached: response.cached || false
    };

  } catch (err) {
    // ถ้าเกิดข้อผิดพลาด ลองใช้ cache เก่า
    const fallbackCache = getCached(cacheKey);
    if (fallbackCache) {
      console.log("⚠️ Using fallback cache due to error");
      return fallbackCache;
    }
    throw err;
  }
};

// 🔸 เพิ่มข้อความหลายรายการในชุดเดียว - รองรับ media
export async function saveMessagesBatch(messagesArray) {
  const res = await fetch("http://localhost:8000/custom_message/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ messages: messagesArray })
  });

  if (!res.ok) throw new Error("บันทึกข้อความชุดไม่สำเร็จ");
  return res.json();
}

// 🔸 ดึงข้อความทั้งหมดในชุดข้อความตาม message_set_id
export async function getMessagesBySetId(messageSetId) {
  const cacheKey = `messages_${messageSetId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch(`http://localhost:8000/custom_messages/${messageSetId}`);
  if (!res.ok) throw new Error("โหลดข้อความไม่สำเร็จ");
  
  const data = await res.json();
  setCache(cacheKey, data);
  return data;
}

// 🔸 ลบข้อความรายตัว
export async function deleteMessageFromDB(messageId) {
  const res = await fetch(`http://localhost:8000/custom_message/${messageId}`, {
    method: "DELETE"
  });

  if (!res.ok) throw new Error("ลบข้อความไม่สำเร็จ");
  
  // Clear related caches
  cache.forEach((value, key) => {
    if (key.startsWith('messages_')) {
      cache.delete(key);
    }
  });
  
  return res.json();
}

export async function createMessageSet({ page_id, set_name }) {
  const res = await fetch("http://localhost:8000/message_set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page_id, set_name }),
  });
  if (!res.ok) throw new Error("ไม่สามารถสร้างชุดข้อความได้");
  
  // Clear cache
  cache.delete(`message_sets_${page_id}`);
  
  return res.json();
}

export async function getMessageSetsByPage(pageId) {
  const cacheKey = `message_sets_${pageId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch(`http://localhost:8000/message_sets/${pageId}`);
  if (!res.ok) throw new Error("ไม่สามารถโหลดชุดข้อความได้");
  
  const data = await res.json();
  setCache(cacheKey, data);
  return data;
}

// 🔸 แก้ไขชื่อชุดข้อความ
export async function updateMessageSet(setId, newName) {
  const res = await fetch(`http://localhost:8000/message_set/${setId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ set_name: newName }),
  });
  if (!res.ok) throw new Error("ไม่สามารถแก้ไขชุดข้อความได้");
  
  // Clear cache
  cache.forEach((value, key) => {
    if (key.startsWith('message_sets_')) {
      cache.delete(key);
    }
  });
  
  return res.json();
}

// 🔸 ลบชุดข้อความ
export async function deleteMessageSet(setId) {
  const res = await fetch(`http://localhost:8000/message_set/${setId}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("ไม่สามารถลบชุดข้อความได้");
  
  // Clear cache
  cache.forEach((value, key) => {
    if (key.startsWith('message_sets_') || key.startsWith('messages_')) {
      cache.delete(key);
    }
  });
  
  return res.json();
}

// 🔸 ล้าง cache
export function clearCache(prefix = null) {
  if (prefix) {
    cache.forEach((value, key) => {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    });
  } else {
    cache.clear();
  }
}

// 🔸 ส่ง batch messages
export async function sendBatchMessages(pageId, psids, messages) {
  const res = await fetch(`http://localhost:8000/send-batch/${pageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ psids, messages })
  });
  
  if (!res.ok) throw new Error("ไม่สามารถส่งข้อความแบบ batch ได้");
  
  // Clear conversation cache
  clearCache('conversations_');
  
  return res.json();
}

// 🔸 อัพโหลดไฟล์ media
export async function uploadMedia(file, mediaType) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('media_type', mediaType);
  
  const res = await fetch("http://localhost:8000/upload-media", {
    method: "POST",
    body: formData
  });
  
  if (!res.ok) throw new Error("ไม่สามารถอัพโหลดไฟล์ได้");
  return res.json();
}