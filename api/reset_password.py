#!/usr/bin/env python3
"""Reset password for a user account."""
import os
import sys

# Add the api directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from werkzeug.security import generate_password_hash
from app_factory import create_app
from extensions.ext_database import db
from models.account import Account

def reset_password(email: str, new_password: str):
    """Reset password for the given email."""
    app = create_app()
    
    with app.app_context():
        account = db.session.query(Account).filter(Account.email == email).first()
        
        if account:
            password_hash = generate_password_hash(new_password)
            account.password = password_hash
            db.session.commit()
            print(f"✅ Password reset successfully for {email}")
            print(f"   New password: {new_password}")
        else:
            print(f"❌ No account found with email: {email}")

if __name__ == "__main__":
    email = "1@qq.com"
    password = "123456"
    
    print(f"Resetting password for {email}...")
    reset_password(email, password)
