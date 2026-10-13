
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region  = "eu-north-1"
  profile = "pacepilot"
}

variable "my_ip" {
  description = "Your public IPv4 address, followed by /32"
  type        = string
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["137112412989"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_key_pair" "pacepilot" {
  key_name   = "pacepilot-aws"
  public_key = file("${pathexpand("~")}/.ssh/pacepilot-aws.pub")
}

resource "aws_security_group" "pacepilot" {
  name        = "pacepilot-web-sg"
  description = "Web access and restricted SSH access"

  ingress {
    description = "HTTP web access"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH from my public IP only"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "PacePilot-Security-Group"
  }
}

resource "aws_instance" "pacepilot" {
  ami                         = data.aws_ami.amazon_linux.id
  instance_type               = "t3.micro"
  key_name                    = aws_key_pair.pacepilot.key_name
  vpc_security_group_ids      = [aws_security_group.pacepilot.id]
  associate_public_ip_address = true

  root_block_device {
    volume_size = 8
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name = "PacePilot-AI"
  }
}

output "public_ip" {
  description = "Public IP address of PacePilot AI"
  value       = aws_instance.pacepilot.public_ip
}
