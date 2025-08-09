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
    const res = await axios.get(`http://localhost:8000/fb-customers/by-page/${pageId}`);

    if (!res.data || res.data.error) {
      throw new Error(res.data?.error || "ไม่สามารถโหลดข้อมูลจาก backend");
    }

    console.log("✅ Raw customer data from backend:", res.data);
    
    // Debug: ตรวจสอบข้อมูล customer type
    res.data.forEach((customer, idx) => {
      if (idx < 5) { // แสดง 5 คนแรก
        console.log(`Customer ${idx + 1}:`, {
          name: customer.name,
          customer_type_custom_id: customer.customer_type_custom_id,
          customer_type_name: customer.customer_type_name
        });
      }
    });

    // Format ข้อมูลให้ตรงกับที่ frontend ต้องการ
    const formattedConversations = res.data.map((conv, idx) => ({
      id: idx + 1,
      updated_time: conv.updated_at,
      created_time: conv.created_at,
      last_user_message_time: conv.last_interaction_at,
      first_interaction_at: conv.first_interaction_at,
      sender_name: conv.name,
      conversation_id: conv.customer_psid,
      conversation_name: conv.name,
      user_name: conv.name,
      raw_psid: conv.customer_psid,
      source_type: conv.source_type,
      // เพิ่มข้อมูล customer type
      customer_type_custom_id: conv.customer_type_custom_id,
      customer_type_name: conv.customer_type_name
    }));

    return formattedConversations;

  } catch (err) {
    console.error("Error fetching conversations:", err);
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

/////////////// ฟังก์ชันสำหรับจัดการกลุ่มลูกค้า ///////////////////////////////

export async function createCustomerGroup(groupData) {
  const res = await fetch("http://localhost:8000/customer-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(groupData),
  });
  if (!res.ok) throw new Error("ไม่สามารถสร้างกลุ่มลูกค้าได้");
  return res.json();
}

export async function getCustomerGroups(pageId, includeInactive = false) {
  const res = await fetch(`http://localhost:8000/customer-groups/${pageId}?include_inactive=${includeInactive}`);
  if (!res.ok) throw new Error("ไม่สามารถโหลดกลุ่มลูกค้าได้");
  return res.json();
}

export async function getCustomerGroup(groupId) {
  const res = await fetch(`http://localhost:8000/customer-group/${groupId}`);
  if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลกลุ่มได้");
  return res.json();
}

export async function updateCustomerGroup(groupId, groupData) {
  const res = await fetch(`http://localhost:8000/customer-groups/${groupId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(groupData),
  });
  if (!res.ok) throw new Error("ไม่สามารถแก้ไขกลุ่มลูกค้าได้");
  return res.json();
}

export async function deleteCustomerGroup(groupId, hardDelete = false) {
  const res = await fetch(`http://localhost:8000/customer-groups/${groupId}?hard_delete=${hardDelete}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("ไม่สามารถลบกลุ่มลูกค้าได้");
  return res.json();
}

export async function autoGroupCustomer(pageId, customerPsid, messageText) {
  const res = await fetch("http://localhost:8000/auto-group-customer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      page_id: pageId,
      customer_psid: customerPsid,
      message_text: messageText
    }),
  });
  if (!res.ok) throw new Error("ไม่สามารถจัดกลุ่มอัตโนมัติได้");
  return res.json();
}

/////////////////////// ฟังก์ชันสำหรับจัดการข้อความของกลุ่ม ///////////////////////
export async function createGroupMessage(messageData) {
  const res = await fetch("http://localhost:8000/group-messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messageData),
  });
  if (!res.ok) throw new Error("ไม่สามารถสร้างข้อความได้");
  return res.json();
}

export async function getGroupMessages(pageId, groupId) {
  const res = await fetch(`http://localhost:8000/group-messages/${pageId}/${groupId}`);
  if (!res.ok) throw new Error("ไม่สามารถโหลดข้อความได้");
  return res.json();
}

export async function updateGroupMessage(messageId, updateData) {
  const res = await fetch(`http://localhost:8000/group-messages/${messageId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData),
  });
  if (!res.ok) throw new Error("ไม่สามารถอัพเดทข้อความได้");
  return res.json();
}

export async function deleteGroupMessage(messageId) {
  const res = await fetch(`http://localhost:8000/group-messages/${messageId}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("ไม่สามารถลบข้อความได้");
  return res.json();
}

export async function createBatchGroupMessages(messages) {
  const res = await fetch("http://localhost:8000/group-messages/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!res.ok) throw new Error("ไม่สามารถสร้างข้อความแบบ batch ได้");
  return res.json();
}

export async function deleteAllGroupMessages(pageId, groupId) {
  const res = await fetch(`http://localhost:8000/group-messages/${pageId}/${groupId}/all`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("ไม่สามารถลบข้อความทั้งหมดได้");
  return res.json();
}

////////////////////// เพิ่มฟังก์ชันสำหรับจัดการ schedules //////////////////////////////

export async function createMessageSchedule(scheduleData) {
  const res = await fetch("http://localhost:8000/message-schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scheduleData),
  });
  if (!res.ok) throw new Error("ไม่สามารถสร้าง schedule ได้");
  return res.json();
}

export async function getGroupSchedules(pageId, groupId) {
  const res = await fetch(`http://localhost:8000/message-schedules/group/${pageId}/${groupId}`);
  if (!res.ok) throw new Error("ไม่สามารถโหลด schedules ได้");
  return res.json();
}

export async function updateMessageSchedule(scheduleId, updateData) {
  const res = await fetch(`http://localhost:8000/message-schedules/${scheduleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData),
  });
  if (!res.ok) throw new Error("ไม่สามารถอัพเดท schedule ได้");
  return res.json();
}

export async function deleteMessageSchedule(scheduleId) {
  const res = await fetch(`http://localhost:8000/message-schedules/${scheduleId}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("ไม่สามารถลบ schedule ได้");
  return res.json();
}

export async function createBatchSchedules(schedules) {
  const res = await fetch("http://localhost:8000/message-schedules/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(schedules),
  });
  if (!res.ok) throw new Error("ไม่สามารถสร้าง schedules แบบ batch ได้");
  return res.json();
}

// เพิ่มฟังก์ชันสำหรับดึง customer type knowledge
export async function getCustomerTypeKnowledge() {
  const res = await fetch("http://localhost:8000/customer-type-knowledge");
  if (!res.ok) throw new Error("ไม่สามารถโหลด customer type knowledge ได้");
  return res.json();
}

export async function getPageCustomerTypeKnowledge(pageId) {
  const res = await fetch(`http://localhost:8000/page-customer-type-knowledge/${pageId}`);
  if (!res.ok) throw new Error("ไม่สามารถโหลด page customer type knowledge ได้");
  return res.json();
}

// ฟังก์ชันสำหรับอัพเดท Knowledge Type
export async function updateCustomerTypeKnowledge(knowledgeId, updateData) {
  const res = await fetch(`http://localhost:8000/customer-type-knowledge/${knowledgeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData),
  });
  if (!res.ok) throw new Error("ไม่สามารถแก้ไข knowledge type ได้");
  return res.json();
}