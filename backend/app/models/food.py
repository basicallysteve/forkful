from pydantic import BaseModel

class Food(BaseModel):
    food_id: int
    name: str
    calories: float
    protein: float
    carbohydrates: float
    fats: float
    