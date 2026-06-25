import math

def area(radius):
    return math.pi * radius ** 2

if __name__ == '__main__':
    radius = float(input("Enter the radius of the circle: "))
    result = area(radius)
    print(f"The area of the circle with radius {radius} is {result:.2f}")
