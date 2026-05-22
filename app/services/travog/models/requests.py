"""
Request models for Travog API.
"""
from pydantic import BaseModel, Field


class QLAuthRequest(BaseModel):
    """Request model for QL authentication."""
    
    company_id: str = Field(alias="companyId")
    account_no: str = Field(default="", alias="accountNo")
    user_name: str = Field(alias="userName")
    password: str = Field()
    source: str = Field(default="")
    
    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "companyId": "QLABS12345",
                "accountNo": "",
                "userName": "sa",
                "password": "Qu@d1@bs",
                "source": ""
            }
        }
 
