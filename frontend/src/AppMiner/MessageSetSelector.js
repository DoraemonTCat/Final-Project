import { useState, useEffect } from "react";
import { getMessageSetsByPage, createMessageSet } from "../Features/Tool";

export default function MessageSetSelector({ pageId, onSelect }) {
  const [sets, setSets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newSetName, setNewSetName] = useState("");

  useEffect(() => {
    if (pageId) {
      getMessageSetsByPage(pageId).then(setSets).catch(console.error);
    }
  }, [pageId]);

  const handleCreate = async () => {
    if (!newSetName.trim()) return alert("กรุณากรอกชื่อชุดข้อความ");

    const created = await createMessageSet({ page_id: pageId, set_name: newSetName });
    setSets([created, ...sets]);
    setSelectedId(created.id);
    setNewSetName("");
    onSelect(created.id);  // ส่ง ID ไปให้ parent ใช้งาน
  };

  return (
    <div style={{ marginBottom: "1rem" }}>
      <label>เลือกชุดข้อความ:</label>
      <select
        value={selectedId || ""}
        onChange={(e) => {
          setSelectedId(e.target.value);
          onSelect(Number(e.target.value));
        }}
      >
        <option value="">-- เลือกชุดข้อความ --</option>
        {sets.map((set) => (
          <option key={set.id} value={set.id}>
            {set.set_name}
          </option>
        ))}
      </select>

      <div style={{ marginTop: "0.5rem" }}>
        <input
          placeholder="ชื่อชุดใหม่"
          value={newSetName}
          onChange={(e) => setNewSetName(e.target.value)}
        />
        <button onClick={handleCreate}>➕ สร้างชุดใหม่</button>
      </div>
    </div>
  );
}