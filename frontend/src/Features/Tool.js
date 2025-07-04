import axios from "axios";

export const fetchPages = () => {
  return axios.get("http://localhost:8000/pages")
    .then(res => res.data.pages || []);
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

// 🔸 เพิ่มข้อความใหม่แบบเดี่ยว
export async function saveMessageToDB({ pageId, messageSetId, messageType, content, displayOrder }) {
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
      display_order: displayOrder
    })
  });

  if (!res.ok) throw new Error("บันทึกข้อความไม่สำเร็จ");
  return res.json();
}

export const fetchConversations = async (pageId) => {
  if (!pageId) return [];

  try {
    // ดึงข้อมูลจาก database โดยตรง (backend จะ sync อัตโนมัติ)
    const res = await axios.get(`http://localhost:8000/conversations-with-last-message/${pageId}`);

    if (res.data.error) {
      throw new Error(res.data.error);
    }

    const conversationsData = res.data.conversations || [];

    // Format ข้อมูลให้ตรงกับที่ frontend ต้องการ
    const formattedConversations = conversationsData.map((conv, idx) => ({
      id: idx + 1,
      updated_time: conv.updated_time,
      created_time: conv.created_time,
      last_user_message_time: conv.last_user_message_time,
      first_interaction_at: conv.first_interaction_at,
      sender_name: conv.user_name || conv.conversation_name,
      conversation_id: conv.conversation_id,
      conversation_name: conv.conversation_name,
      user_name: conv.user_name,
      raw_psid: conv.raw_psid,
      source_type: conv.source_type
    }));

    return formattedConversations;

  } catch (err) {
    throw err;
  }
};

// 🔸 เพิ่มข้อความหลายรายการในชุดเดียว
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
  const res = await fetch(`http://localhost:8000/custom_messages/${messageSetId}`);
  if (!res.ok) throw new Error("โหลดข้อความไม่สำเร็จ");
  return res.json();
}

// 🔸 ลบข้อความรายตัว
export async function deleteMessageFromDB(messageId) {
  const res = await fetch(`http://localhost:8000/custom_message/${messageId}`, {
    method: "DELETE"
  });

  if (!res.ok) throw new Error("ลบข้อความไม่สำเร็จ");
  return res.json();
}

export async function createMessageSet({ page_id, set_name }) {
  const res = await fetch("http://localhost:8000/message_set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page_id, set_name }),
  });
  if (!res.ok) throw new Error("ไม่สามารถสร้างชุดข้อความได้");
  return res.json();
}

export async function getMessageSetsByPage(pageId) {
  const res = await fetch(`http://localhost:8000/message_sets/${pageId}`);
  if (!res.ok) throw new Error("ไม่สามารถโหลดชุดข้อความได้");
  return res.json();
}

// 🔸 ✨ ฟังก์ชันใหม่: แก้ไขชื่อชุดข้อความ
export async function updateMessageSet(setId, newName) {
  const res = await fetch(`http://localhost:8000/message_set/${setId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ set_name: newName }),
  });
  if (!res.ok) throw new Error("ไม่สามารถแก้ไขชุดข้อความได้");
  return res.json();
}

// 🔸 ✨ ฟังก์ชันใหม่: ลบชุดข้อความ
export async function deleteMessageSet(setId) {
  const res = await fetch(`http://localhost:8000/message_set/${setId}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("ไม่สามารถลบชุดข้อความได้");
  return res.json();
}
