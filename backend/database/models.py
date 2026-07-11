import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, relationship
from pgvector.sqlalchemy import Vector

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    role = Column(String, default="user")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    settings = relationship("UserSetting", back_populates="user", cascade="all, delete-orphan", uselist=False)
    threads = relationship("ChatThread", back_populates="user", cascade="all, delete-orphan")
    memories = relationship("UserMemory", back_populates="user", cascade="all, delete-orphan")

class UserSetting(Base):
    __tablename__ = "user_settings"
    
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    theme = Column(String, default="system")
    preferred_model = Column(String, default="auto")
    system_instructions = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="settings")

class ChatThread(Base):
    __tablename__ = "chat_threads"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="threads")
    messages = relationship("ChatMessage", back_populates="thread", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    thread_id = Column(String, ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    plan = Column(Text, nullable=True)
    reasoning = Column(Text, nullable=True)
    routing = Column(JSON, nullable=True)
    metrics = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    thread = relationship("ChatThread", back_populates="messages")

class UserMemory(Base):
    __tablename__ = "user_memories"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=False)  # 768 dimensions for Gemini text-embedding-004
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="memories")
