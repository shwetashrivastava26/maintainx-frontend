function login(){

    let role = document.getElementById("role").value;
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;

    if(
        role === "admin" &&
        username === "admin" &&
        password === "admin@26"
    ){
        alert("Admin Login Successful");
        window.location.href = "dashboard.html";
    }

    else if(
        role === "employee" &&
        username === "employee" &&
        password === "emp@26"
    ){
        alert("Employee Login Successful");
        window.location.href = "dashboard.html";
    }

    else if(
        role === "tracker" &&
        username === "tech" &&
        password === "tech@26"
    ){
        alert("Maintenance Tracker Login Successful");
        window.location.href = "dashboard.html";
    }

    else{
        document.getElementById("message").innerHTML =
        "Invalid Username or Password";
    }
}