import json
import os
from typing import List, Dict, Any
from datetime import datetime

MEMORY_FILE = "memory.json"
MAX_MESSAGES = 10

def load_memory() -> Dict[str, List[Dict[str, Any]]]:
    """Load all conversation memory from JSON file"""
    try:
        if os.path.exists(MEMORY_FILE):
            with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading memory: {e}")
    return {}

def save_memory(session_id: str, role: str, message: str) -> None:
    """
    Save a message to memory for a specific session
    Automatically limits to last MAX_MESSAGES messages
    """
    try:
        # Load existing memory
        memory = load_memory()
        
        # Initialize session if not exists
        if session_id not in memory:
            memory[session_id] = []
        
        # Add new message with timestamp
        memory[session_id].append({
            "role": role,
            "content": message,
            "timestamp": datetime.now().isoformat()
        })
        
        # Keep only last MAX_MESSAGES messages
        if len(memory[session_id]) > MAX_MESSAGES:
            memory[session_id] = memory[session_id][-MAX_MESSAGES:]
        
        # Save back to file
        with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(memory, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        print(f"Error saving memory: {e}")

def load_session_memory(session_id: str) -> List[Dict[str, Any]]:
    """Load memory for a specific session"""
    try:
        memory = load_memory()
        return memory.get(session_id, [])
    except Exception as e:
        print(f"Error loading session memory: {e}")
        return []

def clear_session_memory(session_id: str) -> None:
    """Clear memory for a specific session"""
    try:
        memory = load_memory()
        if session_id in memory:
            del memory[session_id]
            with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
                json.dump(memory, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error clearing session memory: {e}")

def get_memory_stats() -> Dict[str, Any]:
    """Get statistics about stored memory"""
    try:
        memory = load_memory()
        return {
            "total_sessions": len(memory),
            "total_messages": sum(len(messages) for messages in memory.values()),
            "sessions": {sid: len(messages) for sid, messages in memory.items()}
        }
    except Exception as e:
        print(f"Error getting memory stats: {e}")
        return {"total_sessions": 0, "total_messages": 0, "sessions": {}}
