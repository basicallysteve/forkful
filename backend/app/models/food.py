from pydantic import BaseModel
from sqlalchemy import Column, Float, Integer, String, JSON
from app.database import Base

class FoodTable(Base):
    __tablename__ = 'foods'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    calories = Column(Float, nullable=False)
    protein = Column(Float, nullable=False)
    carbs = Column(Float, nullable=False)
    fats = Column(Float, nullable=False)
    serving_size = Column(Float, nullable=False)
    serving_unit = Column(String, nullable=False)
    measurements = Column(JSON, nullable=False)

class Food(BaseModel):
    id: int
    name: str
    calories: float
    protein: float
    carbs: float
    fats: float
    serving_size: float
    serving_unit: str
    measurements: list[str]
