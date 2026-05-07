from pydantic import BaseModel, EmailStr

class RegisterUser(BaseModel):
    name: str
    gender: str
    age: int
    email: EmailStr
    password: str

class LoginUser(BaseModel):
    email: EmailStr
    password: str